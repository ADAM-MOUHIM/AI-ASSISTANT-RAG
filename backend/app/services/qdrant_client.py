import os
from qdrant_client import QdrantClient

_qdrant_client = None

def get_qdrant_client() -> QdrantClient:
    """
    Singleton pattern for Qdrant client.
    Connects to Qdrant (Cloud or local) using environment variables.
    """
    global _qdrant_client
    if _qdrant_client is None:
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY")  # Optional for local

        _qdrant_client = QdrantClient(
            url=qdrant_url,
            api_key=qdrant_api_key
        )
    return _qdrant_client
