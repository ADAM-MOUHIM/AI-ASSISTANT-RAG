from fastapi import APIRouter
from app.schemas.notification import NotificationResponse, NotificationListResponse
from app.services.notifServ import get_user_notifications, mark_notification_as_read
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=NotificationListResponse)
async def get_notifications():
    """Get user notifications"""
    notifications = get_user_notifications()
    return notifications

@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: int):
    """Mark a notification as read"""
    result = mark_notification_as_read(notification_id)
    return result