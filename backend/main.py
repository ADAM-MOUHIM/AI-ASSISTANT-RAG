from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.db.database import test_connection
from app.db.qdrant_client import test_qdrant_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    await test_connection()
    test_qdrant_connection()
    yield

app = FastAPI(lifespan=lifespan)



@app.get("/")
def read_root():
    return {"message": "PostgreSQL test successful!"}


@app.get("/")
def root():
    return {"message": "Hello from FastAPI with Qdrant!"}