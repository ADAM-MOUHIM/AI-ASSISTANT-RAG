from app.services.qdrant_client import get_qdrant_client
from app.services.langchain_service import get_query_embedding
from groq import Groq
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def embed_text(text: str):
    """Helper function to get embeddings"""
    return get_query_embedding(text)

async def get_rag_response(query: str, history: list, user_id: str):
    """
    Retrieve relevant docs from Qdrant, send them + history to Groq model.
    """
    qdrant = get_qdrant_client()
        
    # 1. Retrieve relevant chunks from Qdrant
    try:
        search_results = qdrant.search(
            collection_name="documents",
            query_vector=embed_text(query),
            limit=3
        )
        context = "\n\n".join([hit.payload.get("page_content", "") for hit in search_results])
    except Exception as e:
        print(f"Error searching Qdrant: {e}")
        context = ""
        
    # 2. Prepare prompt
    history_text = ""
    if history:
        for msg in history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"
    
    prompt = f"""
    You are a helpful assistant for user {user_id}.
    Here is some relevant context from documents:
    {context}

    Conversation history:
    {history_text}

    User question: {query}
    """
        
    # 3. Get LLM answer from Groq
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-70b-versatile",  # Groq model
            messages=[
                {"role": "system", "content": "You are a knowledgeable assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=500
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error with Groq API: {e}")
        return "I apologize, but I'm having trouble processing your request right now."
