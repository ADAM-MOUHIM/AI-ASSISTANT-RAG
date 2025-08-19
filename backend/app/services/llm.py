# app/services/llm.py
from __future__ import annotations

import os
from typing import List, Dict, Any

from groq import Groq

# NEW: import your User model to resolve the real role name
from app.db.models.user import User

# Heuristics for doc-like queries
DOCY_TRIGGERS = (
    "document", "pdf", "resume", "cv", "cover letter", "cover",
    "invoice", "shipping", "order", "slides", "presentation", "report"
)

groq_client = None


def get_groq_client() -> Groq:
    global groq_client
    if groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise Exception("GROQ_API_KEY not found in environment variables")
        groq_client = Groq(api_key=api_key)
    return groq_client


def _should_use_rag(question: str) -> bool:
    ql = (question or "").lower()
    return any(t in ql for t in DOCY_TRIGGERS)


def _resolve_roles_from_db(db, user_id: str | int) -> List[str]:
    """
    Return a list with the single role name for this user, if available.
    Safe default: [] (no escalation). We do NOT default to ['user'].
    """
    if db is None or user_id is None:
        return []
    try:
        uid = int(user_id) if isinstance(user_id, str) and user_id.isdigit() else user_id
        u: User | None = db.query(User).get(uid)
        if not u:
            return []
        role = getattr(u, "role", None)
        if isinstance(role, str) and role.strip():
            return [role.strip().lower()]
        name = getattr(role, "name", "") if role is not None else ""
        return [name.strip().lower()] if name else []
    except Exception:
        return []


def _build_rag_prompt(
    *,
    user_id: str | int,
    query: str,
    history: List[Dict[str, Any]] | None,
    evidence: List[Dict[str, Any]],
    max_chunk_chars: int = 1200,
) -> str:
    parts: List[str] = []
    for idx, item in enumerate(evidence, 1):
        meta = item.get("metadata", {}) or {}
        fname = meta.get("filename") or meta.get("source") or f"document:{meta.get('document_id', '?')}"
        text = (item.get("text") or "").strip()
        if not text:
            continue
        if len(text) > max_chunk_chars:
            text = text[:max_chunk_chars] + " …"
        score = item.get("score")
        score_str = f" (similarity {score:.2f})" if isinstance(score, (int, float)) else ""
        parts.append(f"[{idx}] From **{fname}**{score_str}:\n{text}")

    context_block = "\n\n---\n\n".join(parts) if parts else "No matching context found."

    history_lines: List[str] = []
    if history and len(history) > 1:
        for msg in history[:-1]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "").strip()
            if content:
                history_lines.append(f"{role}: {content}")
    history_block = "\n".join(history_lines)

    prompt = f"""You are a helpful AI assistant for user {user_id}.

Use ONLY the provided context to answer the question. If the answer is not in the context, say you couldn't find it in the user's documents.

CONTEXT:
{context_block}

{("CONVERSATION HISTORY:\n" + history_block + "\n") if history_block else ""}USER QUESTION: {query}

Instructions:
- Prefer exact facts from the context.
- Cite the source by its bracket number when relevant (e.g., "[1]").
- If the context doesn't contain the answer, say so briefly instead of guessing.
- Keep the answer concise and clear.
"""
    return prompt


async def get_llm_response(conversation_history: List[Dict[str, Any]], current_user: str | int, db=None) -> str:
    """
    Main entry: try RAG first with correct role-based access.
    If nothing is found, fall back to regular LLM.
    """
    try:
        print(f"🔄 Processing request for user: {current_user}")

        if not conversation_history:
            return "Hello! I'm here to help. What would you like to know?"

        last_question = conversation_history[-1].get("content", "") or ""
        print(f"📝 Question: {last_question}")

        # Import the secured retry ladder
        try:
            from app.services.document_service import rag_search_retry
        except Exception as e:
            print(f"⚠️ Could not import rag_search_retry, falling back to basic LLM: {e}")
            return await get_regular_llm_response(conversation_history, current_user)

        # ✅ Resolve the REAL role(s); do NOT default to ['user']
        roles = _resolve_roles_from_db(db, current_user)
        print(f"🛡 Resolved roles for user {current_user}: {roles}")

        try:
            rag = await rag_search_retry(
                query=last_question,
                user_id=current_user,
                roles=roles,                 # <-- pass actual role(s)
                db=db,
                collection_name="documents",
                min_similarity=0.6,
                limit=5,
            )

            attempts = rag.get("attempts", [])
            print(f"🔍 RAG attempts: {attempts}")

            evidence = rag.get("results", []) or []
            if evidence:
                print(f"✅ Found {len(evidence)} relevant chunks")
                return await get_rag_response(last_question, conversation_history, current_user, {"results": evidence, "total_found": len(evidence)})
            else:
                print("ℹ️ RAG returned no results; using regular LLM fallback")
                return await get_regular_llm_response(conversation_history, current_user)

        except Exception as e:
            print(f"❌ Error during RAG pipeline: {e}")
            return await get_regular_llm_response(conversation_history, current_user)

    except Exception as e:
        print(f"❌ Critical error in get_llm_response: {e}")
        import traceback
        traceback.print_exc()
        return f"I encountered an error: {str(e)}. Please check the logs."


async def get_rag_response(query: str, history: List[Dict[str, Any]], user_id: str | int, search_result: Dict[str, Any]) -> str:
    try:
        evidence: List[Dict[str, Any]] = search_result.get("results", []) or []
        if not evidence:
            print("ℹ️ get_rag_response called with empty evidence; falling back to regular LLM")
            return await get_regular_llm_response(history, str(user_id))

        prompt = _build_rag_prompt(
            user_id=user_id,
            query=query,
            history=history,
            evidence=evidence,
        )

        client = get_groq_client()
        model_name = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a knowledgeable assistant that helps users understand their documents."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1000,
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Error in get_rag_response: {e}")
        return "I found some related context in your documents, but I ran into an error while generating the answer. Please try again."


async def get_regular_llm_response(conversation_history: List[Dict[str, Any]], current_user: str | int) -> str:
    try:
        print(f"🤖 Using regular LLM for user: {current_user}")

        client = get_groq_client()
        model_name = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

        recent_history = conversation_history[-5:] if len(conversation_history) > 5 else conversation_history
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": f"You are a helpful AI assistant for {current_user}. Be friendly and concise."}
        ]
        for msg in recent_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content.strip():
                messages.append({"role": role, "content": content})

        print(f"🔄 Sending {len(messages)} messages to Groq")
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )

        answer = response.choices[0].message.content
        print(f"✅ Got response from Groq: {len(answer)} characters")
        return answer

    except Exception as e:
        print(f"❌ Error in get_regular_llm_response: {e}")
        import traceback
        traceback.print_exc()
        last_q = (conversation_history[-1]["content"] if conversation_history else "").lower()
        if "hello" in last_q or "hi" in last_q:
            return f"Hello {current_user}! I'm your AI assistant. How can I help you today?"
        return "I'm having trouble connecting to the AI service right now. Please try again shortly."
