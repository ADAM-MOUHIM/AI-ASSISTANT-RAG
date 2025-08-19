from app.services.qdrant_client import get_qdrant_client
from app.services.langchain_service import get_query_embedding
from groq import Groq
import os
from app.services.document_service import search_documents  # reuse the fixed one
from app.services.llm import get_groq_client

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def embed_text(text: str):
    """Helper function to get embeddings"""
    return get_query_embedding(text)

async def get_rag_response(query: str, history: list, user_id: str):
    result = await search_documents(query=query, user_id=user_id, limit=3, score_threshold=0.6)
    context = "\n\n".join([r["text"] for r in result["results"]])

    history_text = "\n".join(
        f"{'User' if m.get('role')=='user' else 'Assistant'}: {m.get('content','')}"
        for m in history
    )

    prompt = f"""
You are a helpful assistant for user {user_id}.
Here is some relevant context from documents:
{context}

Conversation history:
{history_text}

User question: {query}
"""

    client = get_groq_client()
    resp = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile"),
        messages=[{"role":"system","content":"You are a knowledgeable assistant."},
                  {"role":"user","content":prompt}],
        temperature=0.2,
        max_tokens=800
    )
    return resp.choices[0].message.content
  
