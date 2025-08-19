from fastapi import APIRouter, Depends, UploadFile, File, HTTPException,Form
from sqlalchemy.orm import Session
import shutil
import os
from app.services.document_service import store_and_process_pdf
from app.db.database import get_db
from app.db.models.user import User
from app.db.models.role import Role
from app.schemas.auth import UserRegister
from app.services.auth_service import hash_password, require_role
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
router = APIRouter(prefix="/admin", tags=["Admin"])


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        orm_mode = True
# -----------------
# Create User (Admin Only)
# -----------------
@router.post("/users")
def create_user(user_data: UserRegister, 
                db: Session = Depends(get_db),
                current_admin: User = Depends(require_role("admin"))):

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    role = db.query(Role).filter(Role.name == user_data.role).first()
    if not role:
        role = Role(name=user_data.role)
        db.add(role)
        db.commit()
        db.refresh(role)

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role_id=role.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully", "user_id": new_user.id}


# -----------------
# Upload Docs for RAG (Admin Only)
# -----------------
UPLOAD_FOLDER = "uploaded_docs"

def infer_group(filename: str) -> str | None:
    n = (filename or "").lower()
    if n.startswith("invoice_"):                    return "invoice"
    if "shipping" in n or "order" in n:            return "shipping_order"
    if "cover" in n or "cv" in n or "resume" in n: return "resume"
    return None

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    group: str | None = Form(None),               # allow admin to set the group
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role("admin")),
):
    # read the bytes
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # choose a group tag (explicit form field beats inference)
    group_tag = group or infer_group(file.filename)

    # process: this stores the DB row AND indexes to Qdrant
    doc = await store_and_process_pdf(
        file_content=content,
        filename=file.filename,
        user_id=str(current_admin.id),               # service normalizes DB to int, metadata to str
        db=db,
        group_tag=group_tag,                         # <-- IMPORTANT for role→group access
        content_type=file.content_type or "application/pdf",
        # collection_name="documents",               # uncomment if you use a custom collection
    )

    return {
        "message": "File uploaded and processed",
        "document": {
            "id": int(doc.id),
            "filename": doc.filename,
            "group_tag": getattr(doc, "group_tag", None),
            "is_processed": bool(getattr(doc, "is_processed", False)),
            "chunks_count": int(getattr(doc, "chunks_count", 0) or 0),
            "status": getattr(doc, "processing_status", None),
        },
    }

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role("admin"))
):
    rows = (
        db.query(User, Role)
        .join(Role, User.role_id == Role.id)
        .order_by(User.id.desc())
        .all()
    )

    return [
        UserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            role=r.name,
            created_at=getattr(u, "created_at", None),
            updated_at=getattr(u, "updated_at", None),
        )
        for (u, r) in rows
    ]