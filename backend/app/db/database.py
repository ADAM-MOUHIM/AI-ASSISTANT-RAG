from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://myuser:mypassword@localhost:5432/mydatabase")

# Create engine with PostgreSQL-specific settings
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True  # Verify connections before use
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    try:
        # Import all models to ensure they're registered
        from app.db.models.chat import ChatSession, ChatMessage
        from app.db.models.document import Document
        
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

# Test database connection - FIXED for SQLAlchemy 2.0
def test_connection():
    try:
        with engine.connect() as connection:
            # Use text() for raw SQL queries in SQLAlchemy 2.0
            result = connection.execute(text("SELECT 1"))
            connection.commit()
        print("✅ Database connection successful!")
        print(f"🔗 Connected to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'Database'}")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("🔍 Troubleshooting steps:")
        print("   1. Check if PostgreSQL is running")
        print("   2. Verify database credentials in .env file")
        print("   3. Ensure database 'mydatabase' exists")
        print("   4. Check if user 'myuser' has proper permissions")
        return False

# Database health check
def get_db_health():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            connection.commit()
        
        # Import models for counting
        from app.db.models.chat import ChatSession, ChatMessage
        
        # Count existing data
        with SessionLocal() as db:
            session_count = db.query(ChatSession).count()
            message_count = db.query(ChatMessage).count()
            
        return {
            "status": "healthy",
            "postgresql_version": version,
            "total_sessions": session_count,
            "total_messages": message_count,
            "timestamp": "2025-08-03 12:22:18"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": "2025-08-03 12:22:18"
        }