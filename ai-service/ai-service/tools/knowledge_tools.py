"""
knowledge_tools.py
The RAG half of the system.

This wraps the Chroma vector store built by rag/ingest.py into a LangChain
tool, so the agent can decide for itself when it needs to look something up
in the knowledge base - which is what makes it "agentic RAG" rather than a
fixed retrieve-then-answer chain.

Pipeline (same as D1S5 + D1s7 notebooks):
    documents -> RecursiveCharacterTextSplitter -> Gemini embeddings
              -> Chroma -> retriever -> tool -> agent
"""

import os

from langchain_core.tools import tool
from langchain_chroma import Chroma

import config
from llm import get_embeddings

_vectorstore: Chroma | None = None


def get_vectorstore() -> Chroma:
    """Open the persisted Chroma collection (built by rag/ingest.py)."""
    global _vectorstore

    if _vectorstore is None:
        if not os.path.isdir(config.CHROMA_DIR):
            raise FileNotFoundError(
                "The vector store does not exist yet. "
                "Run:  python -m rag.ingest"
            )

        _vectorstore = Chroma(
            collection_name=config.CHROMA_COLLECTION,
            persist_directory=config.CHROMA_DIR,
            embedding_function=get_embeddings(),
        )

    return _vectorstore


@tool
def search_financial_knowledge(query: str) -> str:
    """Search FinTack's financial knowledge base.

    Contains India-specific reference material on: fixed deposits, recurring
    deposits, PPF, EPF, NPS, Sukanya Samriddhi, debt and equity mutual funds,
    SIPs, index funds, ELSS, direct stocks, F&O risks, gold (physical, SGB,
    ETF), real estate, REITs, emergency funds, asset allocation by time
    horizon, tax rules, credit card strategy and money-saving tactics.

    ALWAYS call this before giving investment or saving advice, so the answer
    is grounded in the knowledge base rather than invented. For today's actual
    interest rates or prices, use web_search as well - the knowledge base
    explains concepts and rules, not live numbers.
    """
    try:
        retriever = get_vectorstore().as_retriever(
            search_kwargs={"k": config.RETRIEVER_K}
        )

        documents = retriever.invoke(query)

        if not documents:
            return (
                "Nothing relevant found in the knowledge base. "
                "Use web_search instead, and say the answer is general guidance."
            )

        chunks = []
        for index, document in enumerate(documents, start=1):
            source = os.path.basename(
                document.metadata.get("source", "knowledge base")
            )
            chunks.append(
                f"[Source {index}: {source}]\n{document.page_content.strip()}"
            )

        return "\n\n".join(chunks)

    except FileNotFoundError as error:
        return str(error)
    except Exception as error:
        return f"Knowledge base search failed ({error})."


KNOWLEDGE_TOOLS = [search_financial_knowledge]
