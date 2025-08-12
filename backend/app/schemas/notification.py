from pydantic import BaseModel
from typing import List
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    read: bool
    created_at: str

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int