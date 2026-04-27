import sys
import types


fake_ollama = types.ModuleType("ollama")


class DummyClient:
    def __init__(self, *args, **kwargs):
        pass


fake_ollama.Client = DummyClient
sys.modules.setdefault("ollama", fake_ollama)

from app.services import chat_service


def test_answer_question_prefers_faq(monkeypatch) -> None:
    monkeypatch.setattr(
        chat_service,
        "retrieve_best_faq",
        lambda _question: {
            "document_id": 1,
            "source_page": 2,
            "question": "Apa itu SIAPDIK?",
            "answer": "SIAPDIK adalah sistem informasi akademik.",
            "score": 0.91,
        },
    )
    monkeypatch.setattr(chat_service, "retrieve_top_k", lambda *args, **kwargs: [])

    resp = chat_service.answer_question("Apa itu SIAPDIK?")
    assert "sistem informasi akademik" in resp["answer"]
    assert resp["sources"][0]["source_type"] == "faq"


def test_answer_question_falls_back_to_chunks(monkeypatch) -> None:
    monkeypatch.setattr(chat_service, "retrieve_best_faq", lambda _question: None)
    monkeypatch.setattr(
        chat_service,
        "retrieve_top_k",
        lambda *args, **kwargs: [
            {
                "document_id": 2,
                "page_number": 5,
                "content": "SIAPDIK menyediakan endpoint akademik.",
                "score": 0.88,
            }
        ],
    )
    monkeypatch.setattr(chat_service, "generate_answer", lambda *_args, **_kwargs: "Jawaban dari context.")

    resp = chat_service.answer_question("Endpoint apa saja?")
    assert resp["answer"] == "Jawaban dari context."
    assert resp["sources"][0]["source_type"] == "chunk"
