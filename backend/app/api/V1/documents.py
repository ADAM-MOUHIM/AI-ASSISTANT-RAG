# app/api/V1/documents.py
from __future__ import annotations

import io
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.document import Document
from app.db.models.user import User

from app.schemas.document import DocumentResponse, DocumentListResponse
from app.services.document_service import (
    store_and_process_pdf,
    get_user_documents,
    get_document_by_id,
    delete_document,
    reprocess_document,
    search_documents_with_access,
)
from app.services.auth_service import get_current_user
from app.services.authz import require_roles
from app.config.access import ALL_GROUPS

router = APIRouter()


# --- simple, filename-based inference (optional) ---
def infer_group(filename: str) -> str | None:
    n = (filename or "").lower()

    # specific patterns FIRST (so we don't hit generic "order" too early)
    if "purchase_order" in n or n.startswith("po_") or "purch_order" in n or "porder" in n:
        return "purchase_order"

    if n.startswith("invoice_") or "invoice" in n:
        return "invoice"

    if "shipping_order" in n or n.startswith("so_") or ("shipping" in n and "order" in n):
        return "shipping_order"

    if "salary" in n or "payroll" in n:
        return "salary"

    if "inventory" in n or n.startswith("inv_"):
        return "inventory"

    if "employee" in n or "hr_" in n:
        return "employee"

    if "network" in n or "netops" in n:
        return "network"

    if "infra" in n or "infrastructure" in n:
        return "infra"

    # resumes/cover letters (if you use them)
    if "cover" in n or "cv" in n or "resume" in n:
        return "resume"

    return None


# =========================
# Upload
# =========================
@router.post("/upload", response_model=DocumentResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    group_tag: str = Form(...),                 # <-- REQUIRED now (no default, no inference)
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    fname = (file.filename or "").strip()
    if not fname.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # validate against server config
    from app.config.access import ALL_GROUPS
    if group_tag not in ALL_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid group_tag '{group_tag}'. Allowed: {', '.join(ALL_GROUPS)}",
        )

    # DEBUG: see what the server got
    print(f"[UPLOAD] user={user.id} file={fname} group_tag(form)={group_tag}", flush=True)

    doc = await store_and_process_pdf(
        file_content=content,
        filename=fname,
        user_id=str(user.id),
        db=db,
        group_tag=group_tag,                     # <-- use exactly what UI sent
        content_type=file.content_type or "application/pdf",
    )

    # DEBUG: confirm what was persisted
    print(f"[UPLOAD] persisted group_tag in DB: {getattr(doc, 'group_tag', None)} (id={doc.id})", flush=True)

    return DocumentResponse.from_orm(doc)


# =========================
# List documents
# =========================
@router.get("/", response_model=List[DocumentListResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    include_unprocessed: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = get_user_documents(
        db=db,
        user_id=int(user.id),
        include_unprocessed=include_unprocessed,
        limit=limit,
        offset=skip,
        order="desc",
    )
    return [DocumentListResponse.from_orm(d) for d in rows]


# =========================
# Get one document
# =========================
@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = get_document_by_id(db, document_id, user_id=int(user.id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse.from_orm(doc)


# download
@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = get_document_by_id(db, document_id, user_id=int(user.id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return StreamingResponse(
        io.BytesIO(doc.file_content),
        media_type=doc.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.original_filename}"',
            "Content-Length": str(doc.file_size),
        },
    )


@router.get("/{document_id}/text")
async def get_extracted_text(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = get_document_by_id(db, document_id, user_id=int(user.id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "extracted_text": doc.extracted_text,
        "chunks_count": doc.chunks_count,
    }


# =========================
# Reprocess / Delete
# =========================
@router.post("/{document_id}/reprocess")
async def reprocess_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    ok = await reprocess_document(db=db, document_id=document_id, user_id=int(user.id))
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found or processing failed")
    return {"message": "Document reprocessed successfully", "document_id": document_id}


@router.delete("/{document_id}")
async def delete_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    ok = delete_document(db=db, document_id=document_id, user_id=int(user.id))
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully", "document_id": document_id}


@router.delete("/")
async def delete_all_documents(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    docs = get_user_documents(db=db, user_id=int(user.id), include_unprocessed=True, limit=1000, offset=0)
    deleted = 0
    for d in docs:
        if delete_document(db=db, document_id=int(d.id), user_id=int(user.id)):
            deleted += 1
    return {"message": f"Deleted {deleted} documents successfully"}


# =========================
# Search (role → groups first)
# =========================
@router.post("/search")
async def search_user_documents(
    query: str,
    limit: int = 5,
    min_similarity: float = 0.6,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Role-aware search:
    Use group-first visibility (ignore user ownership) by default.
    """
    # normalize role name
    role = getattr(user, "role", None)
    role_name = getattr(role, "name", None) if role else None
    role_name = role_name or "user"

    return await search_documents_with_access(
        query=query,
        user_id=str(user.id),
        roles=[role_name],
        use_user_scope=False,          # groups-only visibility by default
        limit=limit,
        min_similarity=min_similarity, # (alias for score_threshold in some callers)
    )
