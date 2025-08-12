from app.schemas.notification import NotificationResponse, NotificationListResponse
from datetime import datetime

def get_user_notifications() -> NotificationListResponse:
    """Get user notifications (mock data for now)"""
    mock_notifications = [
        {
            "id": 1,
            "title": "Welcome to AI Assistant!",
            "message": "Start your first conversation",
            "type": "info",
            "read": False,
            "created_at": datetime.utcnow().isoformat()
        }
    ]
    
    notifications = [NotificationResponse(**notif) for notif in mock_notifications]
    unread_count = sum(1 for notif in notifications if not notif.read)
    
    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count
    )

def mark_notification_as_read(notification_id: int) -> dict:
    """Mark a notification as read"""
    # In a real app, you'd update the database here
    return {"message": f"Notification {notification_id} marked as read"}