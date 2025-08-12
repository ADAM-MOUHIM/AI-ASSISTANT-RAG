# FastAPI + LangChain + Qdrant Project

## Setup

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create a `.env` file with your PostgreSQL, Qdrant, and OpenAI credentials.

uvicorn main:app --reload
