from app.schemas.user import UserProfileUpdate

def get_current_user_data():
    """Get current user data (hardcoded for now)"""
    return {
        "id": 1,
        "username": "alex.johnson",
        "email": "alex.johnson@example.com",
        "full_name": "Alex Johnson",
        "theme": "light",
        "language": "en",
        "notifications_enabled": True,
        "email_notifications": True,
        "member_since": "Jul 2025"
    }

def update_user_data(current_data: dict, profile_data: UserProfileUpdate) -> dict:
    """
    Update user data with provided fields
    
    Args:
        current_data: Current user data dictionary
        profile_data: Profile update data
    
    Returns:
        Updated user data dictionary
    """
    # Update fields that were provided
    for field, value in profile_data.dict(exclude_unset=True).items():
        if value is not None:
            current_data[field] = value
    
    return current_data