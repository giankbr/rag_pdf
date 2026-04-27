import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    app_name: str = os.getenv("APP_NAME", "RAG PDF Chatbot")
    app_env: str = os.getenv("APP_ENV", "dev")
    app_port: int = int(os.getenv("APP_PORT", "8000"))

    mysql_host: str = os.getenv("MYSQL_HOST", "127.0.0.1")
    mysql_port: int = int(os.getenv("MYSQL_PORT", "3306"))
    mysql_user: str = os.getenv("MYSQL_USER", "root")
    mysql_password: str = os.getenv("MYSQL_PASSWORD", "")
    mysql_database: str = os.getenv("MYSQL_DATABASE", "rag_pdf")

    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "dummy")
    llm_provider: str = os.getenv("LLM_PROVIDER", "dummy")

    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_embedding_model: str = os.getenv(
        "OLLAMA_EMBEDDING_MODEL",
        os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma"),
    )
    ollama_chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:3b")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "2"))
    rag_min_score: float = float(os.getenv("RAG_MIN_SCORE", "0.45"))
    faq_min_score: float = float(os.getenv("FAQ_MIN_SCORE", "0.7"))
    rag_max_context_chars: int = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "1400"))
    ollama_num_predict: int = int(os.getenv("OLLAMA_NUM_PREDICT", "140"))
    ollama_temperature: float = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
    openai_compat_base_url: str = os.getenv(
        "OPENAI_COMPAT_BASE_URL",
        "http://127.0.0.1:1234/v1",
    )
    openai_compat_api_key: str = os.getenv("OPENAI_COMPAT_API_KEY", "")
    openai_compat_model: str = os.getenv(
        "OPENAI_COMPAT_MODEL",
        "qwen/qwen3.5-35b-a3b",
    )
    openai_compat_embed_model: str = os.getenv(
        "OPENAI_COMPAT_EMBED_MODEL",
        "text-embedding-3-small",
    )


settings = Settings()
