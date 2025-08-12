from pydantic import BaseModel, EmailStr
from typing import Optional

class UserProfile(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: str = "light"
    language: str = "en"
    notifications_enabled: bool = True
    email_notifications: bool = True
    member_since: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None

class UserSettings(BaseModel):
    theme: str
    language: str
    notifications_enabled: bool
    email_notifications: bool

class UserStats(BaseModel):
    total_conversations: int
    total_messages: int
    total_documents: int
    member_since: str