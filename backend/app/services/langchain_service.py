import os
# Fix the deprecated import
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    # Fallback to old import if new package not installed
    from langchain_community.embeddings import HuggingFaceEmbeddings

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

# Load env vars
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-70b-8192")

# Embedding model
embeddings_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Qdrant client
def get_qdrant_client() -> QdrantClient:
    """Get Qdrant client"""
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
        
    return QdrantClient(
        url=qdrant_url,
        api_key=qdrant_api_key
    )

def get_llm():
    """Initialize and return Groq LLM"""
    return ChatGroq(
        groq_api_key=GROQ_API_KEY,
        model_name=GROQ_MODEL,
        temperature=0.2
    )

def get_vectorstore(collection_name="documents"):
    """Get or create Qdrant vectorstore"""
    qdrant_client = get_qdrant_client()
        
    # Check if collection exists, create if not
    try:
        collections = qdrant_client.get_collections()
        collection_exists = any(col.name == collection_name for col in collections.collections)
                
        if not collection_exists:
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)  # MiniLM-L6-v2 embedding size
            )
    except Exception as e:
        print(f"Error creating collection: {e}")
        
    return QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection_name,
        embedding=embeddings_model
    )

# Split text into chunks
def chunk_text(text: str, chunk_size=500, chunk_overlap=50):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_text(text)

# Get embeddings for text chunks
def get_embeddings(chunks: list[str]):
    return embeddings_model.embed_documents(chunks)

# Get embedding for a query
def get_query_embedding(query: str):
    return embeddings_model.embed_query(query)

