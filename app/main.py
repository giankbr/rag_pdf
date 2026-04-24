from fastapi import FastAPI
from pydantic import BaseModel

from app.config import settings
from app.db.mysql_client import init_schema
from app.services.chat_service import answer_question

app = FastAPI(title=settings.app_name)

class ChatRequest(BaseModel):
    question: str

@app.on_event("startup")
def on_startup() -> None:
    init_schema()

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "env": settings.app_env}

@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    return answer_question(req.question)
