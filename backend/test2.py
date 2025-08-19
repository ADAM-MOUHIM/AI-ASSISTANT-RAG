# Lists docs & chunk counts per groupTag in Qdrant.
# Filters (userId/role/groups) are OPTIONAL; by default it scans everything.

import os, argparse, collections
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchAny, MatchValue

def args():
    p = argparse.ArgumentParser(description="Inventory docs & chunks per groupTag")
    p.add_argument("--url", default=os.getenv("QDRANT_URL", "http://localhost:6333"))
    p.add_argument("--api-key", default=os.getenv("QDRANT_API_KEY"))
    p.add_argument("--collection", default=os.getenv("QDRANT_COLLECTION", "documents"))
    p.add_argument("--groups", nargs="*", help="Explicit groupTag list (e.g. invoice shipping_order purchase_order)")
    p.add_argument("--user-id", help="Optional userId filter")
    p.add_argument("--role", help="Optional role filter")
    p.add_argument("--batch", type=int, default=512, help="Scroll batch size")
    p.add_argument("--max-points", type=int, default=100000, help="Safety cap for scan")
    return p.parse_args()

def make_filter(user_id=None, role=None, groups=None):
    must = []
    if user_id is not None:
        must.append(FieldCondition(key="userId", match=MatchValue(value=user_id)))
    if role is not None:
        must.append(FieldCondition(key="role", match=MatchValue(value=role)))
    if groups:
        if len(groups) == 1:
            must.append(FieldCondition(key="groupTag", match=MatchValue(value=groups[0])))
        else:
            must.append(FieldCondition(key="groupTag", match=MatchAny(any=groups)))
    return Filter(must=must) if must else None

def scroll_all(client, collection, scroll_filter, limit, cap):
    next_offset = None
    seen = 0
    while True:
        points, next_offset = client.scroll(
            collection_name=collection,
            limit=limit,
            with_payload=True,
            offset=next_offset,
            scroll_filter=scroll_filter
        )
        if not points:
            break
        for p in points:
            yield p
            seen += 1
            if seen >= cap:
                return
        if not next_offset:
            break

def autodiscover_groups(client, collection, base_filter, batch, cap):
    groups = set()
    for p in scroll_all(client, collection, base_filter, batch, min(cap, 20000)):
        g = (p.payload or {}).get("groupTag")
        if g:
            groups.add(g)
    return sorted(groups)

def main():
    a = args()
    client = QdrantClient(url=a.url, api_key=a.api_key)

    base_filter = make_filter(a.user_id, a.role, None)
    groups = a.groups or autodiscover_groups(client, a.collection, base_filter, a.batch, a.max_points)

    print(f"Scanning '{a.collection}' @ {a.url}")
    if a.user_id or a.role:
        print(f"Filters → userId={a.user_id or '*'}  role={a.role or '*'}")
    print(f"Groups: {', '.join(groups) if groups else '(none found)'}")
    if not groups:
        return

    for g in groups:
        f = make_filter(a.user_id, a.role, [g])
        by_doc = collections.defaultdict(lambda: {"docName": None, "path": None, "chunks": 0})
        total = 0

        for p in scroll_all(client, a.collection, f, a.batch, a.max_points):
            pl = p.payload or {}
            key = pl.get("docId") or pl.get("path") or str(p.id)
            rec = by_doc[key]
            rec["docName"] = rec["docName"] or pl.get("docName")
            rec["path"] = rec["path"] or pl.get("path")
            rec["chunks"] += 1
            total += 1

        print(f"\n=== {g} ===")
        print(f"Total chunks: {total} | Unique docs: {len(by_doc)}")
        if total == 0:
            continue

        top = sorted(by_doc.items(), key=lambda kv: kv[1]["chunks"], reverse=True)
        for key, rec in top[:50]:
            name = rec["docName"] or key
            path = f"  [{rec['path']}]" if rec["path"] else ""
            print(f"• {name}  ({rec['chunks']} chunks){path}")
        if len(top) > 50:
            print(f"... {len(top) - 50} more (raise --max-points to scan deeper)")

if __name__ == "__main__":
    main()
