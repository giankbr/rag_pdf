from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import settings
from app.db.mysql_client import count_chunks_by_document, init_schema, insert_document
from app.rag.ingest import ingest_pdf
from app.services.chat_service import answer_question

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/files/raw_pdfs", StaticFiles(directory="data/raw_pdfs"), name="raw_pdfs")

class ChatRequest(BaseModel):
    question: str
    document_id: int | None = None

@app.on_event("startup")
def on_startup() -> None:
    init_schema()

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "env": settings.app_env}

@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    return answer_question(req.question, document_id=req.document_id)


@app.post("/upload-pdf")
def upload_pdf(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    file_name = Path(file.filename).name
    if not file_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    raw_dir = Path("data/raw_pdfs")
    raw_dir.mkdir(parents=True, exist_ok=True)
    target_path = raw_dir / file_name
    suffix = 1
    while target_path.exists():
        target_path = raw_dir / f"{Path(file_name).stem}-{suffix}.pdf"
        suffix += 1

    content = file.file.read()
    target_path.write_bytes(content)

    try:
        document_id = insert_document(
            title=target_path.stem,
            file_name=target_path.name,
        )
        ingest_pdf(str(target_path), document_id=document_id)
        total_chunks = count_chunks_by_document(document_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to ingest PDF: {exc}") from exc

    return {
        "status": "ok",
        "document_id": document_id,
        "file_name": target_path.name,
        "chunks": total_chunks,
        "file_url": f"/files/raw_pdfs/{quote(target_path.name)}",
    }
