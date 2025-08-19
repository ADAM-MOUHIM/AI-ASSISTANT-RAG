# backend/scripts/load_pdfs_to_db.py
import os, io, glob, argparse
from typing import Optional
import PyPDF2
from sqlalchemy.orm import Session

# Ensure ALL models are registered (users, roles, documents) so FKs resolve
import app.db.models  # <- IMPORTANT
from app.db.database import SessionLocal, create_tables, test_connection
from app.db.models.document import Document
from app.db.models.user import User
from app.db.models.role import Role  # ensure mapper is registered
from app.services.document_service import store_and_process_pdf  # for --process


def read_pdf_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    parts = []
    for page in reader.pages:
        parts.append((page.extract_text() or ""))
    return "\n".join(parts).strip()


def infer_group(filename: str) -> Optional[str]:
    """Very simple filename-based grouping. Adjust to your needs."""
    name = filename.lower()
    if name.startswith("invoice_"):
        return "invoice"
    if "shipping" in name or "order" in name:
        return "shipping_order"
    if "cover" in name or "cv" in name or "resume" in name:
        return "resume"
    return None


def resolve_user_id(db: Session, cli_user: Optional[str]) -> int:
    """Return a valid user id. If --user is provided, verify it exists; else pick first user."""
    if cli_user is not None:
        try:
            uid = int(cli_user)
        except ValueError:
            raise RuntimeError(f"--user must be an integer id, got: {cli_user!r}")
        user = db.query(User).filter(User.id == uid).first()
        if not user:
            raise RuntimeError(f"No user found with id={uid}. Create one or omit --user to auto-pick.")
        return uid
    # auto-pick first user (e.g., seeded admin)
    user = db.query(User).first()
    if not user:
        raise RuntimeError("No users found. Start the app once to run seeding, or create a user, then rerun.")
    return int(user.id)


def save_document_row(
    db: Session,
    filename: str,
    pdf_bytes: bytes,
    text: str,
    user_id: int,
    group_tag: Optional[str] = None,  # <-- default so it's not required at call site
) -> int:
    doc = Document(
        filename=filename,
        original_filename=filename,
        user_id=user_id,
        group_tag=group_tag,                 # <-- persist group in Postgres
        file_content=pdf_bytes,
        file_size=len(pdf_bytes),
        content_type="application/pdf",
        extracted_text=text,
        processing_status="uploaded",
        is_processed=False,
        chunks_count=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc.id


async def ingest_one(path: str, user_id: int, db: Session, process: bool, forced_group: Optional[str]) -> int:
    """Insert into Postgres; optionally also chunk+embed into Qdrant. Returns Document.id."""
    filename = os.path.basename(path)
    pdf_bytes = read_pdf_bytes(path)
    text = extract_text_from_pdf(pdf_bytes)
    if not text:
        raise ValueError(f"No text extracted from {filename}")

    group_tag = forced_group or infer_group(filename)

    if process:
        # Use your pipeline (stores in Postgres + processes into Qdrant)
        # NOTE: do NOT pass extracted_text here; store_and_process_pdf handles extraction/metadata itself.
        doc = await store_and_process_pdf(
            file_content=pdf_bytes,
            filename=filename,
            user_id=str(user_id),   # service normalizes and stores as str in metadata
            db=db,
            group_tag=group_tag,    # <-- push group to vectors too
            # content_type defaults are fine
        )
        return int(doc.id)

    # Postgres only
    return save_document_row(db, filename, pdf_bytes, text, user_id, group_tag)


async def main(folder: str, pattern: str, cli_user: Optional[str], process: bool, forced_group: Optional[str]):
    # Ensure DB ready
    if test_connection():
        create_tables()

    paths = sorted(glob.glob(os.path.join(folder, pattern)))
    if not paths:
        print(f"⚠️  No PDFs found under: {os.path.join(folder, pattern)}")
        return

    db: Session = SessionLocal()
    try:
        user_id = resolve_user_id(db, cli_user)
        print(f"📌 Using user_id={user_id} (process={process})")
        print(f"🔎 Found {len(paths)} PDF(s) in {folder}")

        for path in paths:
            name = os.path.basename(path)
            try:
                doc_id = await ingest_one(path, user_id, db, process, forced_group)
                print(f"✅ {name} → Document ID {doc_id}")
            except Exception as e:
                db.rollback()
                print(f"❌ Failed {name}: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    import asyncio
    ap = argparse.ArgumentParser(description="Bulk load PDFs into Postgres (optional Qdrant ingest).")
    ap.add_argument("--path", default="./test", help="Folder with PDFs (default: ./test)")
    ap.add_argument("--pattern", default="*.pdf", help="Glob pattern (default: *.pdf)")
    ap.add_argument("--user", help="Attach to this user id (int). If omitted, auto-picks the first user.")
    ap.add_argument("--process", action="store_true", help="Also chunk+embed into Qdrant via store_and_process_pdf")
    ap.add_argument("--group", help="Force a group_tag for all files (e.g., invoice, shipping_order, resume)")
    args = ap.parse_args()
    asyncio.run(main(args.path, args.pattern, args.user, args.process, args.group))
