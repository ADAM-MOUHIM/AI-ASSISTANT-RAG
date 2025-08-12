# app/services/llm_service.py
from groq import Groq
import os

# Initialize Groq client
groq_client = None

def get_groq_client():
    """Get Groq client with error handling"""
    global groq_client
    if groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise Exception("GROQ_API_KEY not found in environment variables")
        groq_client = Groq(api_key=api_key)
    return groq_client

async def get_llm_response(conversation_history, current_user):
    """
    Enhanced LLM response with RAG capabilities
    """
    try:
        print(f"🔄 Processing request for user: {current_user}")
        
        # Get the last user message
        if not conversation_history:
            return "Hello! I'm here to help! What would you like to know?"
            
        last_question = conversation_history[-1]["content"]
        print(f"📝 Question: {last_question}")
        
        # Try RAG first - search user's documents
        try:
            from app.services.document_service import search_documents
            
            search_result = await search_documents(
                query=last_question,
                user_id=current_user,
                limit=3,
                score_threshold=0.5  # Lower threshold for testing
            )
            
            print(f"🔍 Search result: {search_result['total_found']} documents found")
            
            # Check if we have relevant documents
            if search_result["total_found"] > 0:
                print(f"✅ Found {search_result['total_found']} relevant documents")
                return await get_rag_response(last_question, conversation_history, current_user, search_result)
            else:
                print("ℹ️ No relevant documents found, using regular LLM")
                return await get_regular_llm_response(conversation_history, current_user)
                
        except Exception as e:
            print(f"❌ Error in RAG search: {e}")
            # Fallback to regular LLM
            return await get_regular_llm_response(conversation_history, current_user)
            
    except Exception as e:
        print(f"❌ Critical error in get_llm_response: {e}")
        import traceback
        traceback.print_exc()
        return f"I encountered an error: {str(e)}. Please check the logs."

async def get_rag_response(query: str, history: list, user_id: str, search_result: dict):
    """
    Generate response using retrieved documents from user's uploaded PDFs
    """
    try:
        # 1. Extract context from search results
        context_parts = []
        for result in search_result["results"]:
            text = result["text"]
            filename = result["metadata"].get("filename", "Unknown")
            context_parts.append(f"From {filename}:\n{text}")
        
        context = "\n\n---\n\n".join(context_parts)
        
        # 2. Build conversation history
        history_text = ""
        if history and len(history) > 1:  # Only include if there's more than just the current question
            for msg in history[:-1]:  # Exclude the last message (current question)
                role = "User" if msg.get("role") == "user" else "Assistant"
                content = msg.get("content", "")
                history_text += f"{role}: {content}\n"
        
        # 3. Create comprehensive prompt
        prompt = f"""You are a helpful AI assistant for {user_id}.

Based on the following information from the user's uploaded documents, please answer their question:

RELEVANT CONTEXT:
{context}

{f"CONVERSATION HISTORY:{chr(10)}{history_text}" if history_text else ""}

USER QUESTION: {query}

Instructions:
- Use the provided context to answer the question accurately
- If the context doesn't contain relevant information, say so clearly
- Reference the specific document(s) when possible
- Be concise but thorough
- If you need clarification, ask for it"""

        # 4. Get response from Groq
        response = groq_client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile"),
            messages=[
                {"role": "system", "content": "You are a knowledgeable assistant that helps users understand their documents."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"❌ Error in get_rag_response: {e}")
        return f"I found relevant information in your documents, but encountered an error generating the response: {str(e)}"

async def get_regular_llm_response(conversation_history: list, current_user: str):
    """
    Regular LLM response without RAG (fallback)
    """
    try:
        print(f"🤖 Using regular LLM for user: {current_user}")
        
        # Get Groq client
        client = get_groq_client()
        
        # Get the current question
        current_question = conversation_history[-1]["content"]
        print(f"📝 Processing question: {current_question}")
        
        # Build messages for Groq API
        messages = []
        
        # Add system message
        messages.append({
            "role": "system", 
            "content": f"You are a helpful AI assistant for {current_user}. Be friendly and helpful."
        })
        
        # Add conversation history (last 5 messages to avoid token limits)
        recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
        
        for msg in recent_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content.strip():  # Only add non-empty messages
                messages.append({
                    "role": role,
                    "content": content
                })
        
        print(f"🔄 Sending {len(messages)} messages to Groq")
        
        # Get response from Groq
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama3-70b-8192"),  # ✅ Updated to working model
            messages=messages,
            temperature=0.3,
            max_tokens=800
        )
        
        answer = response.choices[0].message.content
        print(f"✅ Got response from Groq: {len(answer)} characters")
        
        return answer
        
    except Exception as e:
        print(f"❌ Error in get_regular_llm_response: {e}")
        import traceback
        traceback.print_exc()
        
        # Return a basic response if Groq fails
        if "hello" in conversation_history[-1]["content"].lower():
            return f"Hello {current_user}! I'm your AI assistant. How can I help you today?"
        else:
            return "I'm having trouble connecting to the AI service right now. Please try again in a moment."