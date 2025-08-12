from fastapi import APIRouter, FastAPI

from app.api.V1 import chat, users, notifications, documents,auth,admin # Add documents import

api_router = APIRouter()
app = FastAPI()

# Include all endpoint routers
api_router.include_router(chat.router)
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"]) 
api_router.include_router(auth.router)
api_router.include_router(admin.router)          # admin.router has prefix="/admin"

# Add this line

app.include_router(api_router, prefix="/api/v1")

