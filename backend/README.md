# FastAPI + LangChain + Qdrant Project

## Setup

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create a `.env` file with your PostgreSQL, Qdrant, and OpenAI credentials.

uvicorn main:app --reload
"""
Document service: ingest, index, search, list, fetch, delete, and reprocess
documents for the RAG pipeline with LLM orchestration.

Exports (kept broad to stop ImportError churn):
- store_and_process_pdf (async)
- search_documents (async)
- search_documents_with_access (async)
- get_user_documents
- get_user_documents_summary
- get_document_by_id
- get_document_content
- get_document_metadata
- delete_document
- remove_document_points
- reprocess_document (async)
- index_text
- rag_search_retry (async)  # resilient multi-try retrieval
- get_llm_response (async)  # optional: LLM orchestration with RAG routing

Notes:
- Treat LangChain `similarity_search_with_score` return value as SIMILARITY (higher is better).
- Keep results where similarity >= min_similarity (alias: score_threshold).
- Scope searches to user_id; widen via roles -> groups if desired.
- Metadata includes: filename, user_id, document_id, chunk_index, timestamps, group_tag, and legacy group.
- Chunks are prefixed with headers for better filename/ID matching in vectors.
"""