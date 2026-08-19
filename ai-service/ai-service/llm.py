"""
llm.py
Builds the Groq chat model and the Gemini embedding model.

This is the exact same setup as Day 1 Session 2 (ChatGroq) and
Day 1 Session 5 (GoogleGenerativeAIEmbeddings), just wrapped in
functions so the rest of the app can reuse one instance.
"""

from functools import lru_cache

from langchain_groq import ChatGroq
from langchain_google_genai import GoogleGenerativeAIEmbeddings

import config


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    """The reasoning engine of the agent (Groq-hosted, OpenAI-compatible)."""
    return ChatGroq(
        model=config.GROQ_MODEL,
        api_key=config.GROQ_API_KEY,
        temperature=config.GROQ_TEMPERATURE,
        max_retries=2,
        timeout=60,
    )


@lru_cache(maxsize=1)
def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    """
    Groq does not host embedding models, so we use Gemini embeddings
    for the vector store - exactly like the D1S5 / D1s7 notebooks.
    """
    return GoogleGenerativeAIEmbeddings(
        model=config.EMBEDDING_MODEL,
        google_api_key=config.GEMINI_API_KEY,
    )
