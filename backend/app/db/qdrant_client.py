from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(
    host="localhost",
    port=6333,
   
)

def test_qdrant_connection():
    try:
        collections = client.get_collections()
        print("✅ Qdrant connected successfully.")
        print("Collections:", collections)
    except Exception as e:
        print("❌ Qdrant connection failed:", e)
