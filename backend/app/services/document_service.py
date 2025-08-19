# app/services/document_service.py


from __future__ import annotations

import io
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

# LangChain / Qdrant
from langchain.schema import Document as LCDocument
from qdrant_client.models import Filter, FieldCondition, MatchValue

# Internal services (robust imports)
try:
    from app.services.langchain_service import chunk_text, get_vectorstore, get_llm
except Exception:
    from .langchain_service import chunk_text, get_vectorstore, get_llm  # type: ignore

try:
    from app.services.qdrant_client import get_qdrant_client  # noqa: F401
except Exception:
    try:
        from .qdrant_client import get_qdrant_client  # type: ignore # noqa: F401
    except Exception:
        get_qdrant_client = None  # type: ignore

# SQLAlchemy model
try:
    from app.db.models.document import Document
except Exception:
    from .document import Document  # type: ignore

# Optional pydantic schemas (not required here)
try:
    from app.schemas.document import DocumentCreate, DocumentUpdate  # noqa: F401
except Exception:
    pass

# Optional role -> groups mapping
try:
    from app.config.access import groups_for_role  
except Exception:
    def groups_for_role(role: str) -> List[str]:  
        # SECURITY FIX: Return empty list instead of potentially granting access
        _debug(f"⚠️ groups_for_role not available - denying access for role: {role}")
        return []

from qdrant_client.http.models import Filter, FieldCondition, MatchAny, MatchValue


def _collect_roles(
    roles: Optional[Sequence[str]] = None,
    user_role: Optional[Union[str, Sequence[str]]] = None,
    user_roles: Optional[Sequence[str]] = None,
    role: Optional[str] = None,
    access_role: Optional[str] = None,
    access_roles: Optional[Sequence[str]] = None,
) -> List[str]:
    role_list: List[str] = []
    def _add(x):
        if not x: return
        if isinstance(x, str): role_list.append(x)
        else: role_list.extend(list(x))
    _add(roles); _add(user_roles); _add(access_roles); _add(user_role); _add(access_role)
    if role: role_list.append(role)
    return sorted({r.strip().lower() for r in role_list if isinstance(r, str) and r.strip()})

def _access_groups_from_roles(roles: Sequence[str], *extra_roles: Sequence[str]) -> List[str]:
    seen = set()
    for r in list(roles or []) + [*(extra_roles or [])]:
        if not r: continue
        try:
            for g in (groups_for_role(r) or []):
                if g: seen.add(g)
        except Exception:
            pass
    return sorted(seen)

def _strict_access_filter(
    *, allowed_groups: Sequence[str],
    user_id: Optional[Union[str, int]] = None,
    use_user_scope: bool = False,
) -> Filter:
    # Deny by default: impossible match when no groups
    if not allowed_groups:
        return Filter(must=[FieldCondition(key="metadata.group_tag", match=MatchValue(value="__NO_ACCESS__"))])

    must = [FieldCondition(key="metadata.group_tag", match=MatchAny(any=list(allowed_groups)))]
    if use_user_scope and user_id is not None:
        must.append(FieldCondition(key="metadata.user_id", match=MatchValue(value=str(user_id))))
    return Filter(must=must)



# ---------------------------
# Utils
# ---------------------------

def _debug(msg: str) -> None:
    print(msg, flush=True)

def _now() -> datetime:
    return datetime.utcnow()

def _now_iso() -> str:
    return _now().isoformat() + "Z"

def _normalize_user_id(user_id: Union[str, int]) -> int:
    if isinstance(user_id, str) and user_id.isdigit():
        return int(user_id)
    elif isinstance(user_id, int):
        return user_id
    raise ValueError(f"Invalid user_id: {user_id}")

def _normalize_document_id(document_id: Union[str, int]) -> str:
    return str(document_id)

def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Best-effort PDF text extraction."""
    try:
        import PyPDF2  # type: ignore
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        parts: List[str] = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        t = "\n".join(parts)
        if t.strip():
            return t
    except Exception as e:
        _debug(f"⚠️ PyPDF2 failed ({e}); trying pdfminer.six")
    try:
        from pdfminer.high_level import extract_text  # type: ignore
        return extract_text(io.BytesIO(pdf_bytes)) or ""
    except Exception as e:
        _debug(f"⚠️ pdfminer failed: {e}")
    return ""

def _as_str_int_variants(v: Union[str, int]) -> List[Union[str, int]]:
    out = [v]
    try:
        if isinstance(v, str) and v.isdigit():
            out.append(int(v))
        elif isinstance(v, int):
            out.append(str(v))
    except Exception:
        pass
    return out

def _build_user_or_group_filter(
    user_id: Union[str, int],
    groups: Optional[Sequence[str]] = None,
    user_fields: Sequence[str] = ("user_id", "owner_id", "user", "uid"),
    group_field_tag: str = "group_tag",
    group_field_legacy: str = "group",
) -> Filter:
    """
    Owner OR in-allowed-groups.
    Ungrouped docs are owner-only.
    """
    should: List[FieldCondition] = []
    for uf in user_fields:
        for v in _as_str_int_variants(user_id):
            should.append(FieldCondition(key=f"metadata.{uf}", match=MatchValue(value=v)))
            should.append(FieldCondition(key=uf, match=MatchValue(value=v)))
    valid_groups = [g for g in (groups or []) if g and g.strip()]
    for g in valid_groups:
        for k in (f"metadata.{group_field_tag}", f"metadata.{group_field_legacy}", group_field_tag, group_field_legacy):
            should.append(FieldCondition(key=k, match=MatchValue(value=g)))
    if not should:
        return Filter(must=[FieldCondition(key="metadata.user_id", match=MatchValue(value="__NO_ACCESS__"))])
    return Filter(should=should)

def _must_document_ids_filter(doc_ids: Sequence[Union[str, int]]) -> Filter:
    """Match any of the given document_ids across nested and legacy keys."""
    should: List[FieldCondition] = []
    for did in (doc_ids or []):
        s = str(did)
        should.append(FieldCondition(key="metadata.document_id", match=MatchValue(value=s)))
        should.append(FieldCondition(key="document_id", match=MatchValue(value=s)))  # legacy
    return Filter(should=should) if should else Filter()

def _should_filenames_filter(filenames: Sequence[Optional[str]]) -> Filter:
    """Match any filename across nested and legacy keys."""
    should: List[FieldCondition] = []
    for name in (filenames or []):
        if not name:
            continue
        for k in ("metadata.filename", "metadata.source", "filename", "source"):
            should.append(FieldCondition(key=k, match=MatchValue(value=name)))
    return Filter(should=should) if should else Filter()

def _combine_or_filters(*filters: Filter) -> Filter:
    """OR-combine filters by concatenating all must/should into a single should."""
    should: List[FieldCondition] = []
    for flt in filters:
        for attr in ("must", "should"):
            conds = getattr(flt, attr, None) or []
            should.extend(conds)
    return Filter(should=should) if should else Filter()

def _format_result(doc: LCDocument, similarity: float) -> Dict[str, Any]:
    return {
        "text": doc.page_content,
        "score": float(similarity),
        "metadata": dict(doc.metadata or {}),
    }

def _create_chunk_header(
    filename: Optional[str],
    document_id: str,
    user_id: str,
    chunk_index: int
) -> str:
    """A tiny searchable header to help vector search match ids/filenames."""
    return f"[filename:{filename or 'unknown'} | document_id:{document_id} | user_id:{user_id} | chunk:{chunk_index}]\n"

def _detect_question_type(query: str) -> str:
    q = (query or "").lower()
    inv = [
        r'\b(what|which|list|show)\b.*\b(documents?|files?|pdfs?|invoices?|reports?|letters?)\b',
        r'\b(available|have|uploaded|stored)\b.*\b(documents?|files?|pdfs?)\b',
        r'\b(documents?|files?|pdfs?)\b.*\b(available|have|exist)\b',
        r'\bdo\s+you\s+have\b.*\b(documents?|files?|invoices?|reports?)\b',
        r'\bcan\s+you\s+(list|show)\b',
    ]
    if any(re.search(p, q) for p in inv):
        return "inventory"
    doc = [
        r'\b(tell\s+me\s+about|what\s+is\s+in|summarize|explain)\b.*\b(invoice|document|file|pdf|report)\b',
        r'\b(from\s+|in\s+|according\s+to\s+)(the\s+)?(invoice|document|file|pdf|report)\b',
        r'\binvoice[_\s]*\d+\b',  # invoice_12345 or invoice 12345
        r'\b\w+\.(pdf|doc|docx)\b',
        r'\b(content|details|information)\s+(of|from|in)\b',
    ]
    if any(re.search(p, q) for p in doc):
        return "document"
    return "general"

def _extract_doc_hints(query: str) -> List[str]:
    hints: List[str] = []
    q = (query or "").lower()
    hints.extend([f"invoice_{m}" for m in re.findall(r'invoice[_\s]*(\d+)', q)])
    hints.extend([m[0] for m in re.findall(r'\b(\w+\.(pdf|doc|docx|txt))\b', q)])
    for t in ['invoice','report','letter','cover','resume','cv','shipping','order']:
        if t in q:
            hints.append(t)
    return sorted(set(hints))

# ---------------------------
# Indexing (Enhanced with Headers)
# ---------------------------

def index_text(
    *,
    text: str,
    user_id: Union[str, int],
    document_id: Union[str, int],
    collection_name: str = "documents",
    group_tag: Optional[str] = None,
    source_filename: Optional[str] = None,
    chunk_size: int = 1200,
    chunk_overlap: int = 200,
    add_chunk_headers: bool = True,
) -> Dict[str, Any]:
    if not text or not text.strip():
        return {"chunks_count": 0, "collection": collection_name, "error": "No text to index"}

    try:
        vs = get_vectorstore(collection_name)
        chunks = chunk_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        docs: List[LCDocument] = []
        now_iso = _now_iso()

        normalized_user_id = _normalize_user_id(user_id)
        normalized_doc_id = _normalize_document_id(document_id)

        for idx, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            content = _create_chunk_header(source_filename, normalized_doc_id, str(normalized_user_id), idx) + chunk if add_chunk_headers else chunk
            meta = {
                "user_id": str(normalized_user_id),
                "document_id": normalized_doc_id,
                "chunk_index": idx,
                "created_at": now_iso,
            }
            if source_filename:
                meta["filename"] = source_filename
                meta["source"] = source_filename  # legacy
            if group_tag:
                meta["group_tag"] = group_tag
                meta["group"] = group_tag  # legacy
            docs.append(LCDocument(page_content=content, metadata=meta))

        if docs:
            vs.add_documents(docs)
            _debug(f"✅ Indexed {len(docs)} chunks for document_id={normalized_doc_id}")
        else:
            _debug(f"⚠️ No valid chunks to index for document_id={normalized_doc_id}")

        return {"chunks_count": len(docs), "collection": collection_name}

    except Exception as e:
        _debug(f"❌ Failed to index text: {e}")
        return {"chunks_count": 0, "collection": collection_name, "error": str(e)}

# ---------------------------
# Ingest & store
# ---------------------------

async def store_and_process_pdf(
    file_content: bytes,
    filename: str,
    user_id: Union[str, int],
    db: Session,
    *,
    group_tag: Optional[str] = None,
    content_type: Optional[str] = "application/pdf",
    collection_name: str = "documents",
    add_chunk_headers: bool = True,
) -> Document:
    """
    Called by your upload endpoint.
    1) creates the Document row
    2) extracts text and saves it
    3) indexes chunks into Qdrant immediately
    """
    normalized_user_id = _normalize_user_id(user_id)

    # 1) DB row
    document = Document()
    document.filename = filename
    document.original_filename = filename
    document.user_id = normalized_user_id
    document.file_content = file_content
    for attr, value in [
        ("group_tag", group_tag),
        ("content_type", content_type),
        ("file_size", len(file_content)),
        ("processing_status", "processing"),
        ("is_processed", False),
        ("created_at", _now()),
    ]:
        try:
            setattr(document, attr, value)
        except Exception as e:
            _debug(f"⚠️ Could not set {attr}: {e}")

    try:
        db.add(document)
        db.commit()
        db.refresh(document)
        doc_id = getattr(document, "id", None) or str(uuid.uuid4())
    except Exception as e:
        db.rollback()
        _debug(f"❌ Failed to create document record: {e}")
        raise

    # 2) Extract & persist text
    text = _extract_text_from_pdf_bytes(file_content)
    try:
        document.extracted_text = text
        db.commit()
    except Exception as e:
        _debug(f"⚠️ Could not save extracted text: {e}")

    if not text or not text.strip():
        try:
            document.processing_status = "empty"
            document.processed_at = _now()
            db.commit()
        except Exception:
            pass
        return document

    # 3) Index to vector store
    try:
        idx_result = index_text(
            text=text,
            user_id=normalized_user_id,
            document_id=doc_id,
            group_tag=group_tag,
            source_filename=filename,
            collection_name=collection_name,
            add_chunk_headers=add_chunk_headers,
        )
        chunks_count = int(idx_result.get("chunks_count", 0))
        if idx_result.get("error"):
            raise Exception(idx_result["error"])
    except Exception as e:
        _debug(f"❌ Indexing failed: {e}")
        try:
            document.processing_status = "failed"
            document.processing_error = str(e)
            document.processed_at = _now()
            db.commit()
        except Exception:
            pass
        return document

    try:
        document.chunks_count = chunks_count
        document.processing_status = "completed"
        document.is_processed = True
        document.processed_at = _now()
        db.commit()
    except Exception as e:
        _debug(f"⚠️ Could not update completion status: {e}")

    return document

# ---------------------------
# Search (simple)
# ---------------------------

async def search_documents(
    *,
    query: str,
    user_id: Union[str, int],
    limit: int = 5,
    min_similarity: Optional[float] = 0.6,
    collection_name: str = "documents",
    score_threshold: Optional[float] = None,
    **_ignored_kwargs,
) -> Dict[str, Any]:
    if score_threshold is not None and min_similarity is None:
        min_similarity = score_threshold
    if min_similarity is None:
        min_similarity = 0.6

    try:
        normalized_user_id = _normalize_user_id(user_id)
        vs = get_vectorstore(collection_name)
        qfilter = _build_user_or_group_filter(user_id=normalized_user_id, groups=None)

        raw: List[Tuple[LCDocument, float]] = vs.similarity_search_with_score(
            query=query, k=max(limit * 3, limit), filter=qfilter
        )

        _debug(f"🔍 Raw results count: {len(raw)}")
        kept: List[Dict[str, Any]] = []
        for doc, score in raw:
            sim = float(score)
            if sim >= float(min_similarity):
                kept.append(_format_result(doc, sim))
            if len(kept) >= limit:
                break

        _debug(f"✅ Kept {len(kept)} results (>= {min_similarity}).")
        return {
            "results": kept,
            "total_found": len(kept),
            "raw_count": len(raw),
            "kept_count": len(kept),
            "min_similarity": float(min_similarity),
        }

    except Exception as e:
        _debug(f"❌ Search failed: {e}")
        return {
            "results": [], "total_found": 0, "raw_count": 0, "kept_count": 0,
            "min_similarity": float(min_similarity or 0.6), "error": str(e)
        }

# ---------------------------
# Search (with access / aliases)
# ---------------------------

async def search_documents_with_access(
    *, query: str, user_id: Union[str, int],
    roles: Optional[Sequence[str]] = None,
    user_role: Optional[Union[str, Sequence[str]]] = None,
    user_roles: Optional[Sequence[str]] = None,
    role: Optional[str] = None,
    use_user_scope: bool = False,
    access_role: Optional[str] = None,
    access_roles: Optional[Sequence[str]] = None,
    limit: int = 5, min_similarity: Optional[float] = 0.6,
    collection_name: str = "documents",
    score_threshold: Optional[float] = None,
    **_ignored_kwargs,
) -> Dict[str, Any]:
    if score_threshold is not None and min_similarity is None:
        min_similarity = score_threshold
    if min_similarity is None:
        min_similarity = 0.6
    try:
        uid = _normalize_user_id(user_id)
        role_list = _collect_roles(
            roles=roles, user_role=user_role, user_roles=user_roles,
            role=role, access_role=access_role, access_roles=access_roles,
        )
        allowed_groups = _access_groups_from_roles(role_list)
        _debug(f"🛡 roles={role_list} → allowed_groups={allowed_groups}")

        qfilter = _strict_access_filter(allowed_groups=allowed_groups, user_id=uid, use_user_scope=use_user_scope)
        vs = get_vectorstore(collection_name)

        strict_k = max(limit * 3, limit)
        raw = vs.similarity_search_with_score(query=query, k=strict_k, filter=qfilter)
        _debug(f"🔍 A:user+groups: k={strict_k}, min_sim={min_similarity} → raw={len(raw)}")

        kept: List[Dict[str, Any]] = []
        for doc, score in raw:
            sim = float(score)
            grp = (doc.metadata or {}).get("group_tag")
            if grp in allowed_groups and sim >= float(min_similarity):
                kept.append(_format_result(doc, sim))
                if len(kept) >= limit: break

        _debug(f"🔎 A:user+groups → kept: kept={len(kept)}")

        if len(kept) < limit:
            wide_k = max(20, limit * 4)
            wide_min = min(0.4, float(min_similarity))
            raw_wide = vs.similarity_search_with_score(query=query, k=wide_k, filter=qfilter)  # same filter
            _debug(f"🔍 B:user+groups wide: k={wide_k}, min_sim={wide_min} → raw={len(raw_wide)}")
            for doc, score in raw_wide:
                if len(kept) >= limit: break
                sim = float(score)
                grp = (doc.metadata or {}).get("group_tag")
                if grp in allowed_groups and sim >= wide_min:
                    rec = _format_result(doc, sim)
                    if rec not in kept: kept.append(rec)
            _debug(f"🔎 B:user+groups wide → kept: kept={len(kept)}")

        return {
            "results": kept, "total_found": len(kept), "raw_count": len(raw), "kept_count": len(kept),
            "min_similarity": float(min_similarity), "granted_groups": allowed_groups, "roles": role_list,
        }
    except Exception as e:
        _debug(f"❌ Search with access failed: {e}")
        return {
            "results": [], "total_found": 0, "raw_count": 0, "kept_count": 0,
            "min_similarity": float(min_similarity), "granted_groups": [], "roles": [], "error": str(e),
        }

# ---------------------------
# Listing & fetching
# ---------------------------

def get_user_documents(
    db: Session,
    user_id: int,
    *,
    include_unprocessed: bool = True,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    order: str = "desc",
) -> List[Document]:
    try:
        normalized_user_id = _normalize_user_id(user_id)
        q = db.query(Document).filter(Document.user_id == normalized_user_id)
        if not include_unprocessed:
            try: q = q.filter(Document.is_processed.is_(True))
            except Exception: pass
        if search:
            like = f"%{search}%"
            try: q = q.filter(or_(Document.filename.ilike(like), Document.original_filename.ilike(like)))
            except Exception: q = q.filter(Document.filename.ilike(like))
        q = q.order_by(desc(Document.created_at) if order.lower() == "desc" else asc(Document.created_at))
        return q.offset(offset).limit(limit).all()
    except Exception as e:
        _debug(f"❌ Failed to get user documents: {e}")
        return []

def get_user_documents_summary(
    db: Session,
    user_id: int,
    *,
    include_unprocessed: bool = True,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    order: str = "desc",
) -> List[dict]:
    rows = get_user_documents(db=db, user_id=user_id, include_unprocessed=include_unprocessed, search=search, limit=limit, offset=offset, order=order)
    out = []
    for d in rows:
        out.append({
            "id": getattr(d, "id", None),
            "filename": getattr(d, "filename", None),
            "original_filename": getattr(d, "original_filename", None),
            "file_size": getattr(d, "file_size", None),
            "is_processed": getattr(d, "is_processed", None),
            "chunks_count": getattr(d, "chunks_count", None),
            "processing_status": getattr(d, "processing_status", None),
            "created_at": getattr(d, "created_at", None),
            "group_tag": getattr(d, "group_tag", None),
        })
    return out

def get_document_by_id(
    db: Session,
    document_id: int,
    *,
    user_id: Optional[int] = None,
) -> Optional[Document]:
    try:
        q = db.query(Document).filter(Document.id == document_id)
        if user_id is not None:
            normalized_user_id = _normalize_user_id(user_id)
            q = q.filter(Document.user_id == normalized_user_id)
        return q.first()
    except Exception as e:
        _debug(f"❌ Failed to get document by ID: {e}")
        return None

def get_document_content(
    db: Session,
    document_id: int,
    *,
    user_id: Optional[int] = None,
) -> Optional[bytes]:
    doc = get_document_by_id(db, document_id, user_id=user_id)
    return getattr(doc, "file_content", None) if doc else None

def get_document_metadata(
    db: Session,
    document_id: int,
    *,
    user_id: Optional[int] = None,
) -> Optional[dict]:
    doc = get_document_by_id(db, document_id, user_id=user_id)
    if not doc:
        return None
    return {
        "id": doc.id,
        "filename": doc.filename,
        "original_filename": doc.original_filename,
        "user_id": doc.user_id,
        "group_tag": getattr(doc, "group_tag", None),
        "file_size": getattr(doc, "file_size", None),
        "content_type": getattr(doc, "content_type", None),
        "is_processed": getattr(doc, "is_processed", None),
        "chunks_count": getattr(doc, "chunks_count", None),
        "processing_status": getattr(doc, "processing_status", None),
        "processing_error": getattr(doc, "processing_error", None),
        "created_at": getattr(doc, "created_at", None),
        "updated_at": getattr(doc, "updated_at", None),
        "processed_at": getattr(doc, "processed_at", None),
    }

# ---------------------------
# Delete / maintenance
# ---------------------------

def remove_document_points(
    *,
    document_id: Union[str, int],
    collection_name: str = "documents",
) -> int:
    try:
        vs = get_vectorstore(collection_name)
        client = getattr(vs, "client", None)
        if client is None:
            _debug("⚠️ Vectorstore has no direct client handle; cannot run delete.")
            return 0

        doc_id_str = _normalize_document_id(document_id)
        flt = Filter(should=[
            FieldCondition(key="metadata.document_id", match=MatchValue(value=doc_id_str)),
            FieldCondition(key="document_id", match=MatchValue(value=doc_id_str)),
        ])
        points, _ = client.scroll(collection_name=collection_name, scroll_filter=flt, limit=10000, with_payload=False)
        ids = [p.id for p in points]
        if ids:
            client.delete(collection_name=collection_name, points_selector=ids)
            _debug(f"🗑️ Deleted {len(ids)} points for document_id={doc_id_str}.")
            return len(ids)
        _debug(f"ℹ️ No points found for document_id={doc_id_str}.")
        return 0
    except Exception as e:
        _debug(f"❌ Failed to delete points for document_id={document_id}: {e}")
        return 0

def delete_document(
    db: Session,
    document_id: int,
    *,
    user_id: Optional[int] = None,
    collection_name: str = "documents",
) -> bool:
    try:
        doc = get_document_by_id(db, document_id, user_id=user_id)
        if not doc:
            _debug(f"ℹ️ Document not found or not owned (id={document_id}, user={user_id}).")
            return False
        try:
            remove_document_points(document_id=document_id, collection_name=collection_name)
        except Exception as e:
            _debug(f"⚠️ Could not remove vector points for doc {document_id}: {e}")
        db.delete(doc)
        db.commit()
        _debug(f"✅ Deleted document id={document_id}.")
        return True
    except Exception as e:
        _debug(f"❌ DB delete failed for document id={document_id}: {e}")
        try: db.rollback()
        except Exception: pass
        return False

# ---------------------------
# Re-index
# ---------------------------

async def reprocess_document(
    *,
    db: Session,
    document_id: Union[str, int],
    user_id: Union[str, int],
    collection_name: str = "documents",
    add_chunk_headers: bool = True,
) -> bool:
    try:
        normalized_user_id = _normalize_user_id(user_id)
        doc = get_document_by_id(db, int(document_id), user_id=normalized_user_id)
        if not doc:
            _debug(f"❌ Document not found or not owned by user (id={document_id}, user={user_id}).")
            return False

        remove_document_points(document_id=document_id, collection_name=collection_name)

        chunks_count = 0
        text = getattr(doc, "extracted_text", None)
        file_bytes = getattr(doc, "file_content", None)

        if not text or not text.strip():
            if file_bytes:
                _debug(f"Re-extracting text from file_bytes for document_id={document_id}")
                text = _extract_text_from_pdf_bytes(file_bytes)
                try: doc.extracted_text = text
                except Exception: pass

        if text and text.strip():
            try:
                res = index_text(
                    text=text,
                    user_id=normalized_user_id,
                    document_id=document_id,
                    collection_name=collection_name,
                    group_tag=getattr(doc, "group_tag", None),
                    source_filename=getattr(doc, "filename", None),
                    add_chunk_headers=add_chunk_headers,
                )
                chunks_count = int(res.get("chunks_count", 0))
            except Exception as e:
                _debug(f"❌ Failed to reindex document {document_id}: {e}")
                return False

        try:
            if chunks_count > 0:
                doc.chunks_count = chunks_count
                doc.processing_status = "completed"
                doc.is_processed = True
                _debug(f"✅ Reprocessed document {document_id} with {chunks_count} chunks")
            else:
                doc.processing_status = "empty"
                doc.is_processed = False
                _debug(f"⚠️ Document {document_id} has no indexable content")
            doc.processed_at = _now()
            db.commit()
            return chunks_count > 0
        except Exception as e:
            _debug(f"❌ Failed to update document status during reprocess (doc_id={document_id}): {e}")
            try: db.rollback()
            except Exception: pass
            return False

    except Exception as e:
        _debug(f"❌ Reprocess document failed (doc_id={document_id}, user_id={user_id}): {e}")
        return False

# ---------------------------
# Resilient RAG retry ladder
# ---------------------------

async def rag_search_retry(
    *, query: str, user_id: Union[str, int],
    roles: Optional[Sequence[str]] = None,
    db: Optional[Session] = None,
    preferred_doc_terms: Optional[Sequence[str]] = None,
    collection_name: str = "documents",
    min_similarity: float = 0.6, limit: int = 5,
) -> Dict[str, Any]:
    try:
        normalized_user_id = _normalize_user_id(user_id)
        vs = get_vectorstore(collection_name)

        group_list = _access_groups_from_roles(roles or [])
        if roles and not group_list:
            _debug(f"⚠️ No valid groups found for roles: {roles}")

        attempts: List[Dict[str, Any]] = []
        kept: List[Dict[str, Any]] = []

        def _log_try(tag: str, **kw): _debug(f"🔎 {tag}: " + ", ".join(f"{k}={kw[k]}" for k in kw))
        def _keep_similarity(sim: float, min_sim: float) -> bool: return sim >= float(min_sim)

        def _try_search(tag: str, qfilter: Filter, k: int, min_sim: float):
            nonlocal kept
            raw = vs.similarity_search_with_score(query=query, k=k, filter=qfilter)
            _log_try(tag, k=k, min_sim=min_sim, raw=len(raw))
            local_kept: List[Dict[str, Any]] = []
            for doc, score in raw:
                sim = float(score)
                if not _keep_similarity(sim, min_sim): continue
                meta = doc.metadata or {}
                doc_user_id = str(meta.get("user_id", ""))
                doc_group = meta.get("group_tag") or meta.get("group")

                # owner access
                if doc_user_id and doc_user_id == str(normalized_user_id):
                    local_kept.append({"text": doc.page_content, "score": sim, "metadata": dict(meta)})
                    _debug("✅ Access OK: owner")
                    if len(local_kept) >= limit: break
                    continue

                # group access (must be explicitly allowed)
                if doc_group and doc_group in group_list:
                    local_kept.append({"text": doc.page_content, "score": sim, "metadata": dict(meta)})
                    _debug(f"✅ Access OK: group={doc_group}")
                    if len(local_kept) >= limit: break
                    continue

                # denied (ungrouped or forbidden group)
                if doc_group:
                    _debug(f"🔒 DENIED: group {doc_group} not in {group_list}")
                else:
                    _debug("🔒 DENIED: ungrouped doc not owned by user")

            _log_try(tag + " → kept", kept=len(local_kept))
            attempts.append({"tag": tag, "raw": len(raw), "kept": len(local_kept), "k": k, "min_sim": min_sim})
            if not kept and local_kept:
                kept = local_kept

        # A) strict owner-or-group filter
        secure_filter = _build_user_or_group_filter(user_id=normalized_user_id, groups=group_list)
        _try_search("A:user+groups", secure_filter, k=max(3*limit, limit), min_sim=min_similarity)
        if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name}}

        # B) wide recall (same filter; lower threshold)
        _try_search("B:user+groups wide", secure_filter, k=20, min_sim=0.4)
        if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name}}

        # C) user-only fallback
        _try_search("C:user only", _build_user_or_group_filter(user_id=normalized_user_id, groups=None), k=20, min_sim=0.35)
        if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name}}

        # D) DB filename probe — user-owned, then filtered by allowed groups
        candidate_doc_ids: List[int] = []
        candidate_filenames: List[Optional[str]] = []
        if db is not None:
            try:
                ql = (query or "").lower()
                terms = list(preferred_doc_terms or [])
                for h in _extract_doc_hints(query): terms.append(h)
                for t in ["resume","cv","cover","letter","invoice","shipping","order","slides","presentation","report","pdf","doc"]:
                    if t in ql: terms.append(t)
                terms = [t for t in sorted(set(terms)) if t]
                like = "%" + "%".join(terms) + "%" if terms else None
                if like:
                    rows = (db.query(Document.id, Document.filename, Document.original_filename, Document.is_processed)
                              .filter(or_(Document.filename.ilike(like), Document.original_filename.ilike(like)))
                              .filter(Document.user_id == normalized_user_id)
                              .order_by(desc(Document.created_at)).limit(10).all())
                    for r in rows:
                        meta = get_document_metadata(db, r.id, user_id=normalized_user_id)
                        if not meta: continue
                        doc_group = meta.get("group_tag")
                        if not doc_group or doc_group in group_list:
                            candidate_doc_ids.append(int(r.id))
                            candidate_filenames.append(getattr(r, "filename", None))
                _log_try("D:DB filename probe", matches=len(candidate_doc_ids), terms=terms)
            except Exception as e:
                _log_try("D:DB filename probe failed", error=str(e))

        # E) ID/filename constrained searches (still guarded by owner/group)
        if candidate_doc_ids:
            doc_filter = _must_document_ids_filter(candidate_doc_ids)
            user_filter = _build_user_or_group_filter(user_id=normalized_user_id, groups=group_list)
            qfilter = Filter(must=[doc_filter], should=user_filter.should or [])
            _try_search("E:doc_id filter", qfilter, k=30, min_sim=0.3)
            if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name, "doc_ids": candidate_doc_ids}}

        if candidate_filenames:
            fname_filter = _should_filenames_filter(candidate_filenames)
            user_filter = _build_user_or_group_filter(user_id=normalized_user_id, groups=group_list)
            qfilter = Filter(must=[fname_filter], should=user_filter.should or [])
            _try_search("E2:filename filter", qfilter, k=30, min_sim=0.3)
            if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name, "filenames": candidate_filenames}}

        # F) Optional: reindex user-owned docs, then retry (still guarded)
        if db is not None and candidate_doc_ids:
            try:
                reindexed_any = False
                for did in candidate_doc_ids:
                    doc = get_document_by_id(db, did, user_id=normalized_user_id)
                    if doc:
                        _debug(f"🔄 Attempting to reindex document {did}")
                        ok = await reprocess_document(db=db, document_id=did, user_id=normalized_user_id, collection_name=collection_name)
                        reindexed_any = reindexed_any or ok
                    else:
                        _debug(f"🔒 Cannot reindex doc {did} (not owned)")
                if reindexed_any:
                    _debug("🔄 Retrying search after reindexing")
                    _try_search("F:post-reindex", secure_filter, k=30, min_sim=0.3)
                    if kept: return {"results": kept, "attempts": attempts, "params": {"collection": collection_name, "doc_ids": candidate_doc_ids, "reindexed": True}}
            except Exception as e:
                _debug(f"❌ F:reindex failed: {e}")

        return {"results": [], "attempts": attempts, "params": {"collection": collection_name, "groups_checked": group_list}}
    except Exception as e:
        _debug(f"❌ RAG search retry failed: {e}")
        return {"results": [], "attempts": [], "params": {"collection": collection_name}, "error": str(e)}

# ---------------------------
# LLM Orchestration (optional)
# ---------------------------

async def get_llm_response(
    *,
    query: str,
    user_id: Union[str, int],
    db: Session,
    history: Optional[List[Dict[str, str]]] = None,
    roles: Optional[Sequence[str]] = None,
    collection_name: str = "documents",
    min_similarity: float = 0.6,
    max_context_length: int = 4000,
) -> Dict[str, Any]:
    try:
        normalized_user_id = _normalize_user_id(user_id)
        question_type = _detect_question_type(query)
        _debug(f"🎯 Question type detected: {question_type}")

        if question_type == "inventory":
            try:
                # SECURITY: Only show user's own documents unless they have group access
                docs = get_user_documents_summary(db=db, user_id=normalized_user_id, include_unprocessed=False, limit=50)
                
                # Additional filtering based on roles if needed
                if roles:
                    allowed_groups = []
                    for role in roles:
                        try:
                            groups = groups_for_role(role)
                            if groups:
                                allowed_groups.extend(groups)
                        except Exception:
                            pass
                    
                    # You could extend this to show group documents too if needed
                    # For now, keeping it simple to just show user's own docs
                
                if not docs:
                    response = "You haven't uploaded any documents yet."
                else:
                    filenames = [d.get("filename", "Unknown") for d in docs if d.get("is_processed")]
                    response = f"You have {len(filenames)} processed documents:\n" + "\n".join(f"• {fn}" for fn in filenames)
                return {"response": response, "response_type": "inventory", "sources": [d.get("filename", "") for d in docs], "rag_results": None, "metadata": {"document_count": len(docs)}}
            except Exception as e:
                _debug(f"❌ Inventory query failed: {e}")
                return {"response": "I'm having trouble accessing your document list right now.", "response_type": "inventory", "sources": [], "rag_results": None, "metadata": {"error": str(e)}}

        elif question_type == "document":
            try:
                doc_hints = _extract_doc_hints(query)
                # CRITICAL: Use the secure search method
                rag_results = await search_documents_with_access(
                    query=query, 
                    user_id=normalized_user_id, 
                    roles=roles, 
                    collection_name=collection_name, 
                    min_similarity=min_similarity, 
                    limit=5
                )
                
                if not rag_results.get("results"):
                    access_denied = rag_results.get("access_denied", False)
                    if access_denied:
                        return {"response": "You don't have access to documents that could answer that question.", "response_type": "document", "sources": [], "rag_results": rag_results, "metadata": {"access_denied": True}}
                    else:
                        return {"response": "I couldn't find relevant information in your accessible documents for that question.", "response_type": "document", "sources": [], "rag_results": rag_results, "metadata": {"attempts": rag_results.get("attempts", [])}}

                # Rest of the document processing remains the same...
                context_parts = []
                sources = set()
                total_length = 0
                for result in rag_results["results"]:
                    chunk_text = result["text"]
                    if chunk_text.startswith("[filename:"):
                        lines = chunk_text.split("\n", 1)
                        if len(lines) > 1:
                            chunk_text = lines[1]
                    if total_length + len(chunk_text) > max_context_length:
                        break
                    context_parts.append(chunk_text)
                    total_length += len(chunk_text)
                    meta = result.get("metadata", {})
                    fn = meta.get("filename") or meta.get("source")
                    if fn: sources.add(fn)

                context = "\n\n---\n\n".join(context_parts)
                sources_list = sorted(list(sources))

                system_prompt = "You are a helpful assistant that answers questions based on provided document excerpts. Be concise and accurate. If the info isn't in the context, say so."
                user_prompt = f"Based on the following document excerpts, answer: {query}\n\nDocument excerpts:\n{context}\n\nProvide a clear, concise answer."

                llm = get_llm()
                messages = [{"role": "system", "content": system_prompt}]
                if history:
                    for msg in history[-6:]:
                        if msg.get("role") in ["user", "assistant"]:
                            messages.append(msg)
                messages.append({"role": "user", "content": user_prompt})
                llm_response = llm.invoke(messages)
                response_text = llm_response.content if hasattr(llm_response, 'content') else str(llm_response)
                if sources_list and not any(src.lower() in response_text.lower() for src in sources_list):
                    response_text += f"\n\nSource(s): {', '.join(sources_list)}"

                return {"response": response_text, "response_type": "document", "sources": sources_list, "rag_results": rag_results, "metadata": {"chunks_used": len(context_parts), "context_length": total_length, "attempts": rag_results.get("attempts", [])}}

            except Exception as e:
                _debug(f"❌ Document query failed: {e}")
                return {"response": "I encountered an error while searching your documents.", "response_type": "document", "sources": [], "rag_results": None, "metadata": {"error": str(e)}}

        else:
            # General queries remain the same
            try:
                llm = get_llm()
                messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
                if history:
                    for msg in history[-8:]:
                        if msg.get("role") in ["user", "assistant"]:
                            messages.append(msg)
                messages.append({"role": "user", "content": query})
                llm_response = llm.invoke(messages)
                response_text = llm_response.content if hasattr(llm_response, 'content') else str(llm_response)
                return {"response": response_text, "response_type": "general", "sources": [], "rag_results": None, "metadata": {}}
            except Exception as e:
                _debug(f"❌ General query failed: {e}")
                return {"response": "I'm having trouble processing your request right now.", "response_type": "general", "sources": [], "rag_results": None, "metadata": {"error": str(e)}}

    except Exception as e:
        _debug(f"❌ LLM orchestration failed: {e}")
        return {"response": "I encountered an unexpected error.", "response_type": "error", "sources": [], "rag_results": None, "metadata": {"error": str(e)}}