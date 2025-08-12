# backend/scripts/load_pdfs_to_db.py
import os, io, glob, argparse
import PyPDF2
from sqlalchemy.orm import Session

# Ensure ALL models are registered (users, documents, etc.) so FKs resolve
import app.db.models  # <- IMPORTANT
from app.db.database import SessionLocal, create_tables, test_connection
from app.db.models.document import Document
from app.db.models.user import User  # ORM user model
from app.services.document_service import store_and_process_pdf  # for --process

import app.db.models             # ensures Base is shared
from app.db.models.role import Role   # force-register Role
from app.db.models.user import User   # force-register User
from app.db.models.document import Document

def read_pdf_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in reader.pages:
        text += (page.extract_text() or "") + "\n"
    return text.strip()


def resolve_user_id(db: Session, cli_user: str | None) -> int:
    """Return a valid user id. If --user is provided, verify it exists; otherwise pick the first user."""
    if cli_user is not None:
        # accept str or int; cast to int since Document.user_id is Integer
        try:
            uid = int(cli_user)
        except ValueError:
            raise RuntimeError(f"--user must be an integer id, got: {cli_user!r}")
        user = db.query(User).filter(User.id == uid).first()
        if not user:
            raise RuntimeError(f"No user found with id={uid}. Create one or omit --user to auto-pick.")
        return uid

    # auto-pick first user (e.g., the seeded admin)
    user = db.query(User).first()
    if not user:
        raise RuntimeError(
            "No users found. Start the app once to run seed_admin, or create a user, then rerun."
        )
    return int(user.id)


def save_document_row(db: Session, filename: str, pdf_bytes: bytes, text: str, user_id: int) -> int:
    doc = Document(
        filename=filename,
        original_filename=filename,
        user_id=user_id,
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


async def ingest_one(path: str, user_id: int, db: Session, process: bool) -> int:
    """Insert into Postgres; optionally also chunk+embed into Qdrant. Returns Document.id."""
    filename = os.path.basename(path)
    pdf_bytes = read_pdf_bytes(path)
    text = extract_text_from_pdf(pdf_bytes)
    if not text:
        raise ValueError(f"No text extracted from {filename}")

    if process:
        # use your pipeline (stores in Postgres + processes into Qdrant)
        doc = await store_and_process_pdf(
            file_content=pdf_bytes,
            filename=filename,
            user_id=str(user_id),   # your service uses str in metadata; DB column is int
            db=db,
            extracted_text=text,
        )
        return doc.id

    # Postgres only
    return save_document_row(db, filename, pdf_bytes, text, user_id)


async def main(folder: str, pattern: str, cli_user: str | None, process: bool):
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
                doc_id = await ingest_one(path, user_id, db, process)
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
    args = ap.parse_args()
    asyncio.run(main(args.path, args.pattern, args.user, args.process))
