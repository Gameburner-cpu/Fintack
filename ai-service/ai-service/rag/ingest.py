"""
rag/ingest.py
Builds the Chroma vector store from the knowledge base.

This is Day 1 Sessions 3-5 stitched together:
    load documents -> RecursiveCharacterTextSplitter -> Gemini embeddings
                   -> Chroma (persisted to disk)

Run it once after setup, and again any time you edit or add a file in
rag/knowledge/:

    cd ai-service
    python -m rag.ingest

Drop your own .md, .txt or .pdf files into rag/knowledge/ - bank statements,
policy documents, a fund fact sheet - and rerun. They become searchable by
the agent immediately.
"""

import os
import shutil
import sys

# Allow "python -m rag.ingest" AND "python rag/ingest.py" to both work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_community.document_loaders import (
    DirectoryLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma

import config
from llm import get_embeddings


def load_documents():
    """Load every .md, .txt and .pdf file from rag/knowledge/."""
    documents = []

    markdown = DirectoryLoader(
        config.KNOWLEDGE_DIR,
        glob="**/*.md",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
        show_progress=True,
    )
    documents.extend(markdown.load())

    text = DirectoryLoader(
        config.KNOWLEDGE_DIR,
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    )
    documents.extend(text.load())

    pdf = DirectoryLoader(
        config.KNOWLEDGE_DIR,
        glob="**/*.pdf",
        loader_cls=PyPDFLoader,
    )
    documents.extend(pdf.load())

    return documents


def main():
    print("=" * 60)
    print("FinTack AI - building the knowledge base")
    print("=" * 60)

    if not os.path.isdir(config.KNOWLEDGE_DIR):
        raise SystemExit(f"Knowledge folder not found: {config.KNOWLEDGE_DIR}")

    documents = load_documents()
    print(f"Loaded {len(documents)} document(s) from {config.KNOWLEDGE_DIR}")

    if not documents:
        raise SystemExit("No documents found. Add .md/.txt/.pdf files first.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks "
          f"(size={config.CHUNK_SIZE}, overlap={config.CHUNK_OVERLAP})")

    # Rebuild from scratch so edited files do not leave stale chunks behind
    if os.path.isdir(config.CHROMA_DIR):
        shutil.rmtree(config.CHROMA_DIR)
        print("Removed the previous vector store")

    print("Embedding chunks with Gemini... (this takes a minute)")

    Chroma.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        collection_name=config.CHROMA_COLLECTION,
        persist_directory=config.CHROMA_DIR,
    )

    print(f"Vector store written to {config.CHROMA_DIR}")

    # Smoke test - proves retrieval actually works before you start the server
    store = Chroma(
        collection_name=config.CHROMA_COLLECTION,
        persist_directory=config.CHROMA_DIR,
        embedding_function=get_embeddings(),
    )

    print("\nSmoke test: 'where should I invest for 3 years'")
    for index, document in enumerate(
        store.similarity_search("where should I invest for 3 years", k=2),
        start=1,
    ):
        source = os.path.basename(document.metadata.get("source", "?"))
        preview = document.page_content[:160].replace("\n", " ")
        print(f"  {index}. [{source}] {preview}...")

    print("\nDone. Start the service with:  uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    main()
