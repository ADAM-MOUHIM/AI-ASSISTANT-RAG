# app/schemas/document.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    user_id: int                         
    group_tag: Optional[str] = None      

class DocumentCreate(DocumentBase):
    file_content: bytes
    file_size: int
    content_type: str = "application/pdf"
    extracted_text: Optional[str] = None

class DocumentUpdate(BaseModel):
    is_processed: Optional[bool] = None
    chunks_count: Optional[int] = None
    processing_status: Optional[str] = None
    processing_error: Optional[str] = None
    processed_at: Optional[datetime] = None

class DocumentResponse(DocumentBase):
    id: int
    file_size: int
    content_type: str
    is_processed: bool
    chunks_count: int
    processing_status: str
    created_at: datetime
    updated_at: Optional[datetime]
    processed_at: Optional[datetime]
    class Config:
        from_attributes = True

class DocumentListResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    is_processed: bool
    chunks_count: int
    processing_status: str
    created_at: datetime
    group_tag: Optional[str] = None
    class Config:
        from_attributes = True
