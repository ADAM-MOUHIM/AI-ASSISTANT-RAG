# app/db/models/document.py
from sqlalchemy import Column, Integer, String, DateTime, LargeBinary, Text, Boolean,ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    group_tag = Column(String(64), nullable=True, index=True)

    # Store the actual PDF binary data
    file_content = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    content_type = Column(String(50), default="application/pdf")
    
    # Extracted text content for reference
    extracted_text = Column(Text, nullable=True)
    
    # RAG processing info
    is_processed = Column(Boolean, default=False)
    chunks_count = Column(Integer, default=0)
    processing_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    processing_error = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', user='{self.user_id}', size={self.file_size})>"