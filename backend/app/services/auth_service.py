# app/services/auth_service.py
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import os 
from app.db.database import get_db
from app.db.models.user import User
from app.db.models.role import Role

# ---- Config (move to settings.py if you have one)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME_IN_ENV")
# For Swagger's Authorize button; path must include /api/v1
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """
    Extract user from Authorization: Bearer <token>.
    Returns 401 if token missing/invalid/expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        # RFC says JWT claims are strings — cast to int for DB lookup
        user_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).get(user_id)
    if not user:
        raise credentials_exception
    return user

def require_role(required_role: str):
    """
    Use as: current_admin: User = Depends(require_role("admin"))
    Returns 403 if user lacks the role; 401 if not authenticated.
    """
    def _dep(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> User:
        # Resolve role from relationship or id
        role_name = None
        if getattr(user, "role", None):
            # If relationship is loaded with .name
            role_name = getattr(user.role, "name", None) or getattr(user, "role", None)
        if role_name is None:
            # Fallback fetch
            role = db.query(Role).filter(Role.id == user.role_id).first()
            role_name = role.name if role else None

        if role_name != required_role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        return user
    return _dep
