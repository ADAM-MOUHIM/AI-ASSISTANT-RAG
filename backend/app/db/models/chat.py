# app/db/models/chat.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import BaseModel, TimestampMixin  # adjust import if different

class ChatSession(BaseModel, TimestampMixin):
    __tablename__ = "chat_sessions"

    title = Column(String(255), default="New Chat")
    user_id = Column(String(255), nullable=False)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ChatMessage(BaseModel, TimestampMixin):
    __tablename__ = "chat_messages"

    session_id = Column(
        Integer,
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(50), nullable=False)  # 'user' | 'assistant' etc.
    content = Column(Text, nullable=False)

    session = relationship("ChatSession", back_populates="messages")
