# app/services/authz.py
from fastapi import Depends, HTTPException, status
from app.services.auth_service import get_current_user
from app.db.models.user import User  # adjust import path if different

def _role_name(user: User) -> str:
    role = getattr(user, "role", None)
    if isinstance(role, str):
        return role
    return getattr(role, "name", "") or ""


def require_roles(*allowed: str):
    """
    Usage:
      @router.post(..., dependencies=[Depends(require_roles('admin'))])
      or as a param: user: User = Depends(require_roles('admin'))
    """
    allowed_lc = {r.lower() for r in allowed}

    def dep(user: User = Depends(get_current_user)) -> User:
        if _role_name(user).lower() not in allowed_lc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return dep
