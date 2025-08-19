# verify_access.py
import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchAny, MatchValue

URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLL = os.getenv("QDRANT_COLLECTION", "documents")
client = QdrantClient(url=URL)

user = {
    "id": "3",
    "role": "moderator",
    "allowed": ["infra","network","purchase_order"],  # no "invoice"
}

filt = Filter(must=[
    FieldCondition(key="metadata.user_id", match=MatchValue(value=user["id"])),
    FieldCondition(key="metadata.group_tag", match=MatchAny(any=user["allowed"])),
], must_not=[
    FieldCondition(key="metadata.group_tag", match=MatchValue(value="invoice")),
])

# We just scroll to inspect what would be reachable
pts, next_off = client.scroll(collection_name=COLL, limit=256, with_payload=True, scroll_filter=filt)
assert all((p.payload or {}).get("metadata", {}).get("group_tag") != "invoice" for p in pts)
print(f"Accessible points for user {user['id']}: {len(pts)} (none from 'invoice').")
