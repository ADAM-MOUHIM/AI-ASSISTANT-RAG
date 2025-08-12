# app/api/V1/documents.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models.document import Document
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.services.document_service import (
    store_and_process_pdf, 
    get_user_documents, 
    get_document_by_id,
    delete_document,
    reprocess_document,
    search_documents
)
import PyPDF2
import io
import os
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response, Form
from app.db.models.user import User
from app.config.access import ALL_GROUPS
from app.services.authz import require_roles
from app.services.document_service import search_documents_with_access
from app.services.auth_service import get_current_user   # you likely already have this

router = APIRouter()

def get_current_user_id():
    """Helper function to get current user ID"""
    return os.getenv("USER_ID", "ADAM-MOUHIM")

@router.post("/upload", response_model=DocumentResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    group_tag: str = Form("invoice"),
    db: Session = Depends(get_db),
    user = Depends(require_roles("admin")),   # admin-only; no type annotation needed
):
    """
    Upload PDF: Store in PostgreSQL + Process for RAG
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # validate the group tag against your allowed groups
    if group_tag not in ALL_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid group_tag '{group_tag}'. Allowed: {', '.join(ALL_GROUPS)}",
        )

    try:
        # Read PDF content
        pdf_content = await file.read()

        # Extract text from PDF
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text_content = ""
        for page in pdf_reader.pages:
            text_content += (page.extract_text() or "") + "\n"

        if not text_content.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        # Store in PostgreSQL AND process for RAG
        document = await store_and_process_pdf(
            file_content=pdf_content,
            filename=file.filename,
            user_id=str(user.id),         # use the authenticated admin's id
            db=db,
            extracted_text=text_content,
            group_tag=group_tag,          # will be used after Step 4 update
        )

        return DocumentResponse.from_orm(document)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.get("/", response_model=List[DocumentListResponse])
async def list_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user = Depends(get_current_user)):
    docs = get_user_documents(db, str(user.id), skip, limit)
    return [DocumentListResponse.from_orm(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),   # <- use the real auth user
):
    doc = get_document_by_id(db, document_id, str(user.id))  # service will cast to int for DB
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse.from_orm(doc)

# download
@router.get("/{document_id}/download")
async def download_document(document_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    doc = get_document_by_id(db, document_id, str(user.id))
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
async def get_extracted_text(document_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    doc = get_document_by_id(db, document_id, str(user.id))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "extracted_text": doc.extracted_text,
        "chunks_count": doc.chunks_count,
    }

@router.post("/{document_id}/reprocess")
async def reprocess_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_roles("admin")),   # admin only
):
    try:
        ok = await reprocess_document(db, document_id, str(user.id))
        if not ok:
            raise HTTPException(status_code=404, detail="Document not found or processing failed")
        return {"message": "Document reprocessed successfully", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reprocessing document: {e}")


@router.delete("/{document_id}")
async def delete_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_roles("admin")),   # admin only
):
    try:
        ok = delete_document(db, document_id, str(user.id))
        if not ok:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"message": "Document deleted successfully", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting document: {e}")


@router.post("/search")
async def search_user_documents(
    query: str,
    limit: int = 5,
    score_threshold: float = 0.7,
    user = Depends(get_current_user),   # any authenticated user
):
    """
    Role-aware search:
    returns chunks where (owner == user) OR (group ∈ groups allowed by the user's role).
    """
    # extract a simple role name; supports str or relation with .name
    role = getattr(user, "role", None)
    if hasattr(role, "name"):
        role = role.name
    role_name = str(role or "user")

    return await search_documents_with_access(
        query=query,
        user_id=str(user.id),
        user_role=role_name,
        limit=limit,
        score_threshold=score_threshold,
    )


@router.delete("/")
async def delete_all_documents(
    db: Session = Depends(get_db),
    user = Depends(require_roles("admin")),   # admin only
):
    try:
        docs = get_user_documents(db, str(user.id))
        deleted = 0
        for d in docs:
            if delete_document(db, d.id, str(user.id)):
                deleted += 1
        return {"message": f"Deleted {deleted} documents successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting documents: {e}")
