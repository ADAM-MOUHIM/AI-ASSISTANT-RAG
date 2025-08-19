# scripts/backfill_qdrant_all.py
import os, sys, argparse
from sqlalchemy import or_, desc

# make project importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import get_db
from app.db.models.document import Document
from app.services.document_service import index_text, remove_document_points, _extract_text_from_pdf_bytes
from app.services.langchain_service import get_vectorstore
from qdrant_client.models import Filter, FieldCondition, MatchValue

COLL_DEFAULT = os.getenv("QDRANT_COLLECTION", "documents")

def doc_has_points(client, collection, doc_id):
    flt = Filter(should=[
        FieldCondition(key="metadata.document_id", match=MatchValue(value=str(doc_id))),
        FieldCondition(key="document_id",        match=MatchValue(value=str(doc_id))),  # legacy
    ])
    return client.count(collection_name=collection, count_filter=flt, exact=True).count > 0

def main(collection, only_like=None, only_group=None, only_missing=False, delete_first=False, limit=None):
    db_gen = get_db(); db = next(db_gen)
    try: db.expire_on_commit = False
    except Exception: pass

    q = db.query(Document)
    if only_like:
        like = f"%{only_like}%"
        q = q.filter(or_(Document.filename.ilike(like), Document.original_filename.ilike(like)))
    if only_group:
        q = q.filter(Document.group_tag == only_group)
    q = q.order_by(desc(Document.created_at))
    if limit: q = q.limit(limit)

    rows = q.all()
    print(f"Found {len(rows)} docs to (re)index")
    vs = get_vectorstore(collection); client = vs.client

    total_ok = 0; total_skipped = 0; total_deleted = 0
    for r in rows:
        doc_id = int(getattr(r, "id"))
        uid    = getattr(r, "user_id")
        fname  = getattr(r, "filename", "—")
        gtag   = getattr(r, "group_tag", None)

        if only_missing and doc_has_points(client, collection, doc_id):
            print(f"skip (has points): {doc_id} {fname}")
            total_skipped += 1
            continue

        if delete_first:
            try:
                total_deleted += remove_document_points(document_id=doc_id, collection_name=collection)
            except Exception as e:
                print(f"delete points failed for {doc_id}: {e}")

        text = (getattr(r, "extracted_text", None) or "").strip()
        if not text:
            fb = getattr(r, "file_content", None)
            if fb:
                text = _extract_text_from_pdf_bytes(fb) or ""

        if not text.strip():
            print(f"skip (no text): {doc_id} {fname}")
            total_skipped += 1
            continue

        res = index_text(
            text=text,
            user_id=uid,
            document_id=doc_id,
            collection_name=collection,
            group_tag=gtag,
            source_filename=fname,
        )
        chunks = int(res.get("chunks_count", 0))
        print(f"indexed {doc_id} {fname}: chunks={chunks}")
        if chunks > 0: total_ok += 1

    print("\nSummary")
    print("-------")
    print("indexed ok   :", total_ok)
    print("skipped      :", total_skipped)
    print("points deleted (if any):", total_deleted)

    try:
        next(db_gen)
    except StopIteration:
        pass

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--collection", default=COLL_DEFAULT)
    ap.add_argument("--only-like", help="index only filenames LIKE this (e.g. 'invoice_')")
    ap.add_argument("--only-group", help="index only a specific group_tag (e.g. 'invoice')")
    ap.add_argument("--only-missing", action="store_true", help="index only docs that currently have 0 points")
    ap.add_argument("--delete-first", action="store_true", help="delete existing points for each doc before indexing")
    ap.add_argument("--limit", type=int, help="limit number of docs processed")
    args = ap.parse_args()
    main(args.collection, args.only_like, args.only_group, args.only_missing, args.delete_first, args.limit)
