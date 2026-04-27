from pathlib import Path
import json
from urllib import request

from ollama import Client
from pypdf import PdfReader

from app.config import settings
from app.db.mysql_client import insert_chunk, insert_document


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return [c.strip() for c in chunks if c.strip()]


def embed_text(text: str) -> list[float]:
    if settings.embedding_provider == "openai_compat":
        if not settings.openai_compat_api_key:
            raise ValueError("OPENAI_COMPAT_API_KEY belum diset")

        payload = {
            "model": settings.openai_compat_embed_model,
            "input": text,
        }
        req = request.Request(
            url=f"{settings.openai_compat_base_url}/embeddings",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.openai_compat_api_key}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["data"][0]["embedding"]

    if settings.embedding_provider != "ollama":
        raise ValueError("Embedding provider belum dikenali. Gunakan 'ollama' atau 'openai_compat'.")

    client = Client(host=settings.ollama_base_url)
    response = client.embed(model=settings.ollama_embedding_model, input=text)
    embeddings = response.get("embeddings", [])
    if not embeddings:
        raise ValueError("Ollama returned empty embeddings")
    return embeddings[0]


def ingest_pdf(pdf_path: str, document_id: int) -> None:
    reader = PdfReader(pdf_path)
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        chunks = chunk_text(page_text)
        for idx, content in enumerate(chunks):
            vector = embed_text(content)
            insert_chunk(
                document_id=document_id,
                page_number=page_number,
                chunk_index=idx,
                content=content,
                embedding=vector,
            )


def ingest_all_raw_pdfs() -> None:
    raw_folder = Path("data/raw_pdfs")
    for pdf_file in sorted(raw_folder.glob("*.pdf")):
        document_id = insert_document(title=pdf_file.stem, file_name=pdf_file.name)
        ingest_pdf(str(pdf_file), document_id=document_id)
