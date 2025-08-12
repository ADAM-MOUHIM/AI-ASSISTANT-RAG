from typing import Optional, List, Literal
from pydantic import BaseModel
from datetime import datetime

# ---- Pydantic schemas used by the endpoints ----
class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    message_count: int

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

    class Config:
        orm_mode = True
