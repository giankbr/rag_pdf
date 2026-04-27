import sys
import types
fake_ollama = types.ModuleType("ollama")


class DummyClient:
    def __init__(self, *args, **kwargs):
        pass


fake_ollama.Client = DummyClient
sys.modules.setdefault("ollama", fake_ollama)

from app.rag.ingest import chunk_text
from app.rag.retriever import cosine_similarity


def test_chunk_text_returns_non_empty_chunks() -> None:
    text = "A" * 1600
    chunks = chunk_text(text, chunk_size=700, overlap=120)
    assert len(chunks) >= 2
    assert all(c.strip() for c in chunks)


def test_cosine_similarity_identical_vectors_is_one() -> None:
    score = cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0])
    assert abs(score - 1.0) < 1e-9


def test_cosine_similarity_orthogonal_vectors_is_zero() -> None:
    score = cosine_similarity([1.0, 0.0], [0.0, 1.0])
    assert abs(score - 0.0) < 1e-9
