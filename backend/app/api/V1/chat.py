# chat.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Literal, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models.chat import ChatSession, ChatMessage
from app.db.models.user import User
from app.services.auth_service import get_current_user
from app.services.llm import get_llm_response
from app.services.document_service import search_documents_with_access

router = APIRouter(prefix="/chat", tags=["Chat"])
# ==== Schemas ====
class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    class Config:
        orm_mode = True

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

class ConversationCreate(BaseModel):
    title: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: str

# ==== Session endpoints ====
@router.post("/sessions", response_model=ConversationResponse, status_code=201)
def create_session(
    payload: ConversationCreate = ConversationCreate(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = ChatSession(title=payload.title or "New chat", user_id=str(user.id))
    db.add(s); db.commit(); db.refresh(s)
    count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
    return ConversationResponse(
        id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at, message_count=count
    )

@router.get("/sessions", response_model=List[ConversationResponse])
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == str(user.id))
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    results = []
    for s in sessions:
        count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        results.append(ConversationResponse(
            id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at, message_count=count
        ))
    return results

@router.put("/sessions/{session_id}", response_model=ConversationResponse)
def rename_session(
    session_id: int,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.query(ChatSession).get(session_id)
    if not s or s.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Chat not found")
    s.title = payload.title
    s.updated_at = datetime.utcnow()
    db.commit(); db.refresh(s)
    count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
    return ConversationResponse(
        id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at, message_count=count
    )

@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.query(ChatSession).get(session_id)
    if not s or s.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(s); db.commit()
    return

# ==== Message endpoints (single definition) ====
@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.query(ChatSession).get(session_id)
    if not s or s.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Chat not found")
    msgs = (db.query(ChatMessage)
              .filter(ChatMessage.session_id == session_id)
              .order_by(ChatMessage.created_at.asc())
              .all())
    return [MessageResponse(id=m.id, role=m.role, content=m.content, created_at=m.created_at) for m in msgs]

@router.post("/sessions/{session_id}/messages", response_model=MessageResponse, status_code=201)
async def post_session_message(
    session_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Validate session ownership
    s = db.query(ChatSession).get(session_id)
    if not s or s.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Chat not found")

    # Save the user's message
    user_msg = ChatMessage(session_id=session_id, role="user", content=payload.content)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Build message history (ascending)
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    # Get assistant reply (your service can still do RAG internally)
    reply_text = await get_llm_response(messages, str(user.id), db=db)

    # Persist assistant message
    bot_msg = ChatMessage(session_id=session_id, role="assistant", content=reply_text)
    db.add(bot_msg)
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(bot_msg)

    return MessageResponse(
        id=bot_msg.id,
        role=bot_msg.role,
        content=bot_msg.content,
        created_at=bot_msg.created_at,
    )
