"""
config.py
Central configuration for the FinTack AI Agent Service.
Everything is read from environment variables (.env file).
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ==========================================================
#                       API KEYS
# ==========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Supabase - reuse the SAME values that are already in backend/.env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")

# Shared secret so only your Node backend can call this service.
# Deliberately has NO default - a default would ship as a working password.
AGENT_SERVICE_TOKEN = os.getenv("AGENT_SERVICE_TOKEN")


# ==========================================================
#                       MODELS
# ==========================================================

# Groq model used for the agent's reasoning + tool calling.
# gpt-oss-120b handles multi-step tool calling much better than 20b.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0"))

# Gemini embedding model (used only for the RAG vector store)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")


# ==========================================================
#                       RAG SETTINGS
# ==========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

KNOWLEDGE_DIR = os.path.join(BASE_DIR, "rag", "knowledge")
CHROMA_DIR = os.path.join(BASE_DIR, "rag", "chroma_db")
CHROMA_COLLECTION = "fintack_knowledge"

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "900"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "150"))
RETRIEVER_K = int(os.getenv("RETRIEVER_K", "4"))


# ==========================================================
#                       SERVER
# ==========================================================

PORT = int(os.getenv("PORT", "8000"))

# This service is called by your Node backend, NOT by browsers, so the default
# is deliberately empty. Only add origins here if you have a reason to.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]


def assert_config():
    """Fail fast at startup with a clear message instead of a cryptic error later."""
    missing = []

    if not GROQ_API_KEY:
        missing.append("GROQ_API_KEY")
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE:
        missing.append("SUPABASE_SERVICE_ROLE")
    if not AGENT_SERVICE_TOKEN:
        missing.append("AGENT_SERVICE_TOKEN")

    if missing:
        raise RuntimeError(
            "Missing environment variables in ai-service/.env: "
            + ", ".join(missing)
        )
