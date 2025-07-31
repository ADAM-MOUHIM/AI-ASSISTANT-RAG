from fastapi import APIRouter

router = APIRouter()

@router.post("/v1")
def ingest_data():
    return {"message": "Data ingested"}
