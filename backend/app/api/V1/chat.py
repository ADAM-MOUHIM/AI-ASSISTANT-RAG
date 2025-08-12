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
    s = db.query(ChatSession).get(session_id)
    if not s or s.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Chat not found")

    # 1) save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=payload.content)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 2) build history
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    convo = [{"role": m.role, "content": m.content} for m in history]

    # 3) role-aware RAG: owner OR allowed groups for the user's role
    role = getattr(user, "role", None)
    if hasattr(role, "name"):
        role = role.name
    role_name = str(role or "user")

    try:
        rag = await search_documents_with_access(
            query=payload.content,
            user_id=str(user.id),
            user_role=role_name,
            limit=5,
            score_threshold=0.7,  # cosine distance: lower is better
        )
    except Exception as e:
        print("RAG failed:", e)
        rag = {"results": []}

    # 4) add retrieved context as a system message (non-destructive)
    ctx_chunks = [r.get("text", "") for r in (rag.get("results") or [])][:3]
    if ctx_chunks:
        context_text = "\n\n".join(ctx_chunks).strip()
        convo = [
            {"role": "system", "content": f"Use this context from allowed documents:\n{context_text}"},
            *convo,
        ]

    # 5) LLM reply (unchanged signature)
    reply_text = await get_llm_response(convo, str(user.id))

    # 6) persist assistant message
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

