# Fixed streaming implementation for chat.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Literal, Optional, AsyncGenerator
from pydantic import BaseModel
from datetime import datetime
import json
import asyncio

from app.db.database import get_db
from app.db.models.chat import ChatSession, ChatMessage
from app.db.models.user import User
from app.services.auth_service import get_current_user
from app.services.llm import get_llm_response, get_llm_response_stream
from app.services.document_service import search_documents_with_access

router = APIRouter(prefix="/chat", tags=["Chat"])

# ==== Schemas (unchanged) ====
class MessageCreate(BaseModel):
    content: str
    stream: Optional[bool] = False

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

# ==== Session endpoints (unchanged) ====
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

# ==== Message endpoints ====
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

# FIXED: Streaming helper function
async def stream_chat_response(
    session_id: int,
    payload: MessageCreate,
    db: Session,
    user: User
) -> AsyncGenerator[str, None]:
    """Generate streaming response for chat messages - FIXED VERSION"""
    
    # Add error handling wrapper
    try:
        print(f"🔄 Starting stream for session {session_id}, user {user.id}")
        
        # Validate session ownership
        s = db.query(ChatSession).get(session_id)
        if not s or s.user_id != str(user.id):
            error_data = json.dumps({'error': 'Chat not found'})
            yield f"data: {error_data}\n\n"
            return

        # Save the user's message
        user_msg = ChatMessage(session_id=session_id, role="user", content=payload.content)
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)
        print(f"💾 Saved user message: {user_msg.id}")

        # Send user message confirmation
        user_data = json.dumps({
            'type': 'user_message', 
            'content': payload.content, 
            'id': user_msg.id,
            'created_at': user_msg.created_at.isoformat()
        })
        yield f"data: {user_data}\n\n"

        # Build message history
        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        messages = [{"role": m.role, "content": m.content} for m in history]
        print(f"📚 Built history with {len(messages)} messages")

        # Start streaming assistant response
        full_response = ""
        
        print("🤖 Starting LLM streaming...")
        async for chunk in get_llm_response_stream(messages, str(user.id), db=db):
            if chunk:  # Only send non-empty chunks
                full_response += chunk
                
                # Send chunk to client
                chunk_data = json.dumps({'type': 'assistant_chunk', 'content': chunk})
                yield f"data: {chunk_data}\n\n"
                
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.01)

        print(f"✅ Completed streaming, total response length: {len(full_response)}")

        # Save complete assistant message to database
        bot_msg = ChatMessage(session_id=session_id, role="assistant", content=full_response)
        db.add(bot_msg)
        s.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(bot_msg)
        print(f"💾 Saved assistant message: {bot_msg.id}")

        # Send completion signal with final message info
        complete_data = json.dumps({
            'type': 'assistant_complete', 
            'id': bot_msg.id, 
            'content': full_response, 
            'created_at': bot_msg.created_at.isoformat()
        })
        yield f"data: {complete_data}\n\n"
        yield "data: [DONE]\n\n"

    except Exception as e:
        print(f"❌ Stream error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        error_data = json.dumps({'error': f'Internal server error: {str(e)}'})
        yield f"data: {error_data}\n\n"
        yield "data: [DONE]\n\n"

# FIXED: Main message endpoint
@router.post("/sessions/{session_id}/messages")
async def post_session_message(
    session_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    print(f"📨 Received message for session {session_id}, stream={payload.stream}")
    
    # If streaming is requested, return streaming response
    if payload.stream:
        print("🌊 Initiating streaming response...")
        return StreamingResponse(
            stream_chat_response(session_id, payload, db, user),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
    
    # Otherwise, use the original non-streaming logic
    print("📝 Using non-streaming response...")
    
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

    # Get assistant reply
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