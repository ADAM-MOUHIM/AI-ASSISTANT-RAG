from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.user import User
from app.db.models.role import Role
from app.schemas.auth import UserRegister, Token
from app.services.auth_service import (
    hash_password, verify_password,
    create_access_token, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# NOTE: You don't need a local oauth2_scheme here. auth_service.py already defines one
# with tokenUrl="/api/v1/auth/login" for Swagger. Keeping another here can confuse things.

# -----------------
# Register User
# -----------------
@router.post("/register", response_model=Token)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if username or email exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Get or create role
    role = db.query(Role).filter(Role.name == user_data.role).first()
    if not role:
        role = Role(name=user_data.role)
        db.add(role)
        db.commit()
        db.refresh(role)

    # Create user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role_id=role.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # ✅ Use user ID in sub (string). Optionally include role claim.
    access_token = create_access_token(data={"sub": str(new_user.id), "role": role.name})
    return {"access_token": access_token, "token_type": "bearer"}

# -----------------
# Login User
# -----------------
@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm expects fields: username, password (form-encoded)
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ✅ Use user ID in sub (string). Optionally include role claim.
    role_name = user.role.name if user.role else None
    access_token = create_access_token(data={"sub": str(user.id), "role": role_name})
    return {"access_token": access_token, "token_type": "bearer"}

# -----------------
# Get Current User
# -----------------
@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.name if current_user.role else None
    }
