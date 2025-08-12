from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models.chat import ChatSession, ChatMessage
from app.schemas.user import UserProfile, UserProfileUpdate, UserSettings, UserStats
from app.services.userServ import get_current_user_data, update_user_data
import os
from app.services.auth_service import get_current_user

router = APIRouter()

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(current = Depends(get_current_user)):
    # current is a User ORM
    return UserProfile(
        username=current.username,
        email=current.email,
        # fill other fields from your DB or defaults
        full_name=None,
        avatar_url=None,
        theme="light",
        language="en",
        notifications_enabled=True,
        email_notifications=True,
        member_since=current.created_at.isoformat() if hasattr(current, "created_at") else "N/A",
    )

@router.get("/profile", response_model=UserProfile)
async def get_user_profile():
    """Get current user's profile information"""
    user_data = get_current_user_data()
    return UserProfile(**user_data)

@router.put("/profile", response_model=UserProfile)
async def update_user_profile(profile_data: UserProfileUpdate):
    """Update user profile information"""
    # Get current data
    current_data = get_current_user_data()
    
    # Update fields that were provided
    updated_data = update_user_data(current_data, profile_data)
    
    return UserProfile(**updated_data)

@router.get("/settings", response_model=UserSettings)
async def get_user_settings():
    """Get user's preference settings"""
    user_data = get_current_user_data()
    return UserSettings(
        theme=user_data["theme"],
        language=user_data["language"],
        notifications_enabled=user_data["notifications_enabled"],
        email_notifications=user_data["email_notifications"]
    )

@router.put("/settings", response_model=UserSettings)
async def update_user_settings(settings: UserSettings):
    """Update user preference settings"""
    # In a real app, you'd save to database here
    # For now, just return the provided settings
    return settings

@router.get("/stats", response_model=UserStats)
async def get_user_stats(db: Session = Depends(get_db)):
    """Get user statistics"""
    current = Depends(get_current_user)

    
    # Count conversations
    total_conversations = db.query(ChatSession).filter(
        ChatSession.user_id == current
    ).count()
    
    # Count messages
    total_messages = db.query(ChatMessage).join(ChatSession).filter(
        ChatSession.user_id == current
    ).count()
    
    # For now, hardcode documents count (add Document model later)
    total_documents = 0
    
    return UserStats(
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_documents=total_documents,
        member_since="Jul 2025"
    )

@router.post("/signout")
async def sign_out():
    """Handle user sign out"""
    # In a real app, you'd invalidate tokens here
    return {"message": "Successfully signed out"}