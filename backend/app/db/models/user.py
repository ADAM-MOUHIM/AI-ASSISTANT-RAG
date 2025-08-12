# app/db/models/user.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from app.db.base_class import Base  # or BaseModel/TimestampMixin if you have it
from sqlalchemy.orm import relationship

class User(Base):  # or (BaseModel, TimestampMixin) if that’s your pattern
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", back_populates="users")
    # add these if you don't have TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
