from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# Replace with your actual PostgreSQL connection URL
DATABASE_URL = "postgresql://postgres:0000@localhost:5432/mydb"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Connection test function
async def test_connection():
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))  # ✅ wrap in text()
        print("✅ PostgreSQL connection successful")
    except SQLAlchemyError as e:
        print("❌ PostgreSQL connection failed:", e)
        raise e
    finally:
        db.close()
