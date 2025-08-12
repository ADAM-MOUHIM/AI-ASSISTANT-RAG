# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.applications import Starlette
from starlette.routing import Route
from app.api.V1.api import api_router
from app.db.database import create_tables, test_connection
from app.utils.seed_admin import seed_admin
import asyncio, os, traceback

app = FastAPI(
    title="AI Assistant API",
    version="1.0.0",
    servers=[{"url": "http://127.0.0.1:8000"}, {"url": "http://localhost:8000"}],
)

# CORS for your Vite dev server

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",  # Swagger/docs (127)
        "http://localhost:8000",  # Swagger/docs (localhost)
        "http://127.0.0.1:5173",  # Vite
        "http://localhost:5173",  # Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔒 Watchdog so no request can hang forever
REQUEST_TIMEOUT_SECS = float(os.getenv("REQUEST_TIMEOUT_SECS", "15"))

@app.middleware("http")
async def watchdog(request, call_next):
    try:
        return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECS)
    except asyncio.TimeoutError:
        return JSONResponse({"error": "request timed out"}, status_code=504)

# Mount a dependency-free health endpoint (bypasses routers/middleware chains)
def _health(_):
    return JSONResponse({"ok": True})

health_app = Starlette(routes=[Route("/", _health)])
app.mount("/api/v1/health", health_app)

# Your existing routers
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "AI Assistant API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "AI Assistant API"}

@app.on_event("startup")
async def startup_event():
    print("🚀 Starting AI Assistant API...")
    try:
        # Ensure models are registered with SQLAlchemy
        import app.db.models  # loads User, Role, Chat, Document, etc.

        # Optional: skip DB init/seed for quick debugging
        if os.getenv("SKIP_STARTUP_DB") == "1":
            print("⚠️  SKIP_STARTUP_DB=1 → skipping DB init/seed")
            return

        if not test_connection():
            print("❌ DB connection failed; skipping create_tables/seed")
            return

        if create_tables():
            print("✅ Database tables ready")
        else:
            print("❌ create_tables() failed; skipping seed")
            return

        seed_admin()
        print("✅ Admin seeding done")

    except Exception:
        print("❌ Startup failed:")
        traceback.print_exc()  # do NOT swallow—log it so we can see it
        # Let app continue so /docs still loads and you can debug
