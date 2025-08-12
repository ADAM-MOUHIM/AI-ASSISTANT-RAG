# app/utils/seed_admin.py
import os
from sqlalchemy.orm import Session
from app.db.models.user import User
from app.db.models.role import Role
from app.services.auth_service import hash_password
from app.db.database import SessionLocal

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-now")
ADMIN_ROLE = "admin"

def seed_admin():
    db: Session = SessionLocal()

    # Ensure admin role exists
    role = db.query(Role).filter(Role.name == ADMIN_ROLE).first()
    if not role:
        role = Role(name=ADMIN_ROLE)
        db.add(role)
        db.commit()
        db.refresh(role)

    # Ensure admin user exists
    user = db.query(User).filter(User.username == ADMIN_USERNAME).first()
    if not user:
        user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role_id=role.id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ Admin user created: {ADMIN_USERNAME} / {ADMIN_EMAIL}")
    else:
        print("ℹ️ Admin user already exists")

    db.close()
