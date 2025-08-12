# app/services/document_service.py (Enhanced version)
import os
from typing import List, Optional
from sqlalchemy.orm import Session
from app.services.langchain_service import chunk_text, get_vectorstore, embeddings_model
from app.services.qdrant_client import get_qdrant_client
from app.db.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate
from langchain.schema import Document as LangchainDocument
import uuid
from datetime import datetime
from qdrant_client.models import Filter, FieldCondition, MatchValue
from app.config.access import groups_for_role
from qdrant_client.models import Filter, FieldCondition, MatchValue
async def store_and_process_pdf(
    file_content: bytes,
    filename: str, 
    user_id: str,
    db: Session,
    extracted_text: str,
    group_tag: str = "invoice",                 # ← NEW
) -> Document:
    """
    Store PDF in PostgreSQL and process for RAG
    """
    try:
        # 1. Create document record in PostgreSQL
        document_data = DocumentCreate(
            filename=filename,
            original_filename=filename,
            user_id=int(user_id),
            file_content=file_content,
            file_size=len(file_content),
            content_type="application/pdf",
            extracted_text=extracted_text
        )
        db_document = Document(
    filename=document_data.filename,
    original_filename=document_data.original_filename,
    user_id=int(document_data.user_id),         # ← cast for DB (Integer col)
    file_content=document_data.file_content,
    file_size=document_data.file_size,
    content_type=document_data.content_type,
    extracted_text=document_data.extracted_text,
    processing_status="processing",
    # only if you added a column `group_tag` in Document model:
    group_tag=group_tag if hasattr(Document, "group_tag") else None,  # ← optional
)

        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        print(f"✅ PDF stored in PostgreSQL with ID: {db_document.id}")
        
        # 2. Process for RAG
        try:
            result = await ingest_pdf_content(
                pdf_text=extracted_text,
                filename=filename,
                user_id=user_id,
                document_id=db_document.id,
                group_tag=group_tag
            )
            
            # 3. Update processing status
            db_document.is_processed = True
            db_document.chunks_count = result["chunks_count"]
            db_document.processing_status = "completed"
            db_document.processed_at = datetime.utcnow()
            
            db.commit()
            
            print(f"✅ RAG processing completed: {result['chunks_count']} chunks")
            
        except Exception as rag_error:
            # Update with error status
            db_document.processing_status = "failed"
            db_document.processing_error = str(rag_error)
            db.commit()
            
            print(f"❌ RAG processing failed: {rag_error}")
            raise rag_error
            
        return db_document
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error storing PDF: {e}")
        raise e

async def search_documents(query: str, user_id: str, limit: int = 5, score_threshold: float = 0.7) -> dict:
    try:
        print(f"🔍 Searching for: '{query}' for user: {user_id}")
        vectorstore = get_vectorstore(collection_name="documents")

        q_filter = Filter(must=[FieldCondition(key="user_id", match=MatchValue(value=str(user_id)))])
        results = vectorstore.similarity_search_with_score(query=query, k=limit, filter=q_filter)
        print(f"🔍 Raw results count: {len(results)}")

        formatted_results = []
        for doc, score in results:
            dist = float(score)
            print(f"📄 Distance: {dist} (<= threshold {score_threshold} is a match)")
            if dist <= float(score_threshold):
                formatted_results.append({
                    "text": doc.page_content,
                    "score": dist,            # distance (lower is better)
                    "metadata": doc.metadata,
                })

        print(f"✅ Filtered results: {len(formatted_results)} documents")
        return {"query": query, "total_found": len(formatted_results), "results": formatted_results}
    except Exception as e:
        print(f"❌ Error searching documents: {e}")
        import traceback; traceback.print_exc()
        return {"query": query, "total_found": 0, "results": []}


def _distance_ok(dist: float, threshold: float) -> bool:
    # Qdrant cosine distance: lower = better. Keep results within the threshold.
    try:
        return float(dist) <= float(threshold)
    except Exception:
        return False

async def search_documents_with_access(
    query: str,
    user_id: str,
    user_role: str,
    limit: int = 5,
    score_threshold: float = 0.7,
) -> dict:
    """
    Return chunks where (owner == user_id) OR (group ∈ groups allowed by user_role).
    """
    try:
        allowed_groups = groups_for_role(user_role)
        print(f"🔍 RAG for user={user_id} role={user_role} allowed={allowed_groups}")

        vectorstore = get_vectorstore(collection_name="documents")

        # OR filter over owner and allowed groups
        should = [FieldCondition(key="user_id", match=MatchValue(value=str(user_id)))]
        should += [FieldCondition(key="group", match=MatchValue(value=g)) for g in allowed_groups]

        q_filter = Filter(should=should)

        results = vectorstore.similarity_search_with_score(
            query=query, k=limit, filter=q_filter
        )
        print(f"🔍 Raw results: {len(results)}")

        out = []
        for doc, dist in results:
            d = float(dist)
            if _distance_ok(d, score_threshold):
                out.append({
                    "text": doc.page_content,
                    "score": d,             # distance (lower is better)
                    "metadata": doc.metadata,
                })

        print(f"✅ Kept {len(out)} results (<= {score_threshold})")
        return {"query": query, "total_found": len(out), "results": out}

    except Exception as e:
        print("❌ Role search error:", e)
        import traceback; traceback.print_exc()
        return {"query": query, "total_found": 0, "results": []}




async def ingest_pdf_content(
    pdf_text: str, 
    filename: str, 
    user_id: str,
    document_id: Optional[int] = None,
    group_tag: str = "invoice",
):
    """
    Enhanced PDF content ingestion with PostgreSQL linking
    """
    try:
        # 1. Split text into chunks
        chunks = chunk_text(pdf_text, chunk_size=500, chunk_overlap=50)
        
        if not chunks:
            raise ValueError("No chunks generated from PDF text")
        
        # 2. Create documents with enhanced metadata
        documents = []
        for i, chunk in enumerate(chunks):
            doc = LangchainDocument(
                page_content=chunk,
                metadata={
                    "filename": filename,
                    "user_id": user_id,
                    "group": group_tag,
                    "chunk_id": f"{filename}_{i}",
                    "document_id": document_id,  # Link to PostgreSQL record
                    "chunk_index": i,
                    "timestamp": datetime.utcnow().isoformat(),
                    "total_chunks": len(chunks)
                }
            )
            documents.append(doc)
        
        # 3. Get vectorstore and add documents
        vectorstore = get_vectorstore(collection_name="documents")
        vectorstore.add_documents(documents)
        
        print(f"Successfully ingested {len(chunks)} chunks from {filename}")
        return {"message": f"Successfully processed {len(chunks)} chunks", "chunks_count": len(chunks)}
        
    except Exception as e:
        print(f"Error ingesting PDF content: {e}")
        raise e

def get_user_documents(db: Session, user_id: str, skip: int = 0, limit: int = 100) -> List[Document]:
    return db.query(Document).filter(Document.user_id == int(user_id)).offset(skip).limit(limit).all()



def get_document_by_id(db: Session, document_id: int, user_id: str) -> Optional[Document]:
    return db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == int(user_id)
    ).first()


def delete_document(db: Session, document_id: int, user_id: str) -> bool:
    """Delete document from both PostgreSQL and Qdrant"""
    try:
        # 1. Get document from PostgreSQL
        document = get_document_by_id(db, document_id, user_id)
        if not document:
            return False
        
        # 2. Delete from Qdrant (chunks with this document_id)
        try:
            qdrant_client = get_qdrant_client()
            qdrant_client.delete(
                collection_name="documents",
                points_selector={
                    "filter": {
                        "must": [
                            {"key": "document_id", "match": {"value": document_id}},
                            {"key": "user_id", "match": {"value": user_id}}
                        ]
                    }
                }
            )
            print(f"✅ Deleted Qdrant chunks for document {document_id}")
        except Exception as qdrant_error:
            print(f"⚠️  Error deleting from Qdrant: {qdrant_error}")
        
        # 3. Delete from PostgreSQL
        db.delete(document)
        db.commit()
        
        print(f"✅ Deleted document {document_id} from PostgreSQL")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error deleting document: {e}")
        return False

async def reprocess_document(db: Session, document_id: int, user_id: str) -> bool:
    """Reprocess a document for RAG (if needed)"""
    try:
        document = get_document_by_id(db, document_id, user_id)
        if not document:
            return False
        
        # Delete existing chunks from Qdrant
        qdrant_client = get_qdrant_client()
        qdrant_client.delete(
            collection_name="documents",
            points_selector={
                "filter": {
                    "must": [
                        {"key": "document_id", "match": {"value": document_id}}
                    ]
                }
            }
        )
        
        # Reprocess
        result = await ingest_pdf_content(
            pdf_text=document.extracted_text,
            filename=document.filename,
            user_id=user_id,
            document_id=document_id
        )
        
        # Update status
        document.chunks_count = result["chunks_count"]
        document.processing_status = "completed"
        document.processed_at = datetime.utcnow()
        db.commit()
        
        return True
        
    except Exception as e:
        print(f"❌ Error reprocessing document: {e}")
        return False