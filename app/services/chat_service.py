import json
from urllib import request

from ollama import Client

from app.config import settings
from app.db.mysql_client import fetch_all_faqs
from app.rag.ingest import embed_text
from app.rag.retriever import cosine_similarity
from app.rag.retriever import retrieve_top_k


def build_context(chunks: list[dict]) -> str:
    parts: list[str] = []
    for c in chunks:
        parts.append(f"[Doc {c['document_id']} - Page {c['page_number']}]\n{c['content']}")
    context = "\n\n".join(parts)
    return context[: settings.rag_max_context_chars]


def generate_answer(question: str, context: str) -> str:
    if not context.strip():
        return "Maaf, saya belum menemukan konteks yang relevan dari dokumen."

    system_prompt = (
        "Kamu adalah asisten yang menjawab hanya berdasarkan konteks dokumen yang diberikan. "
        "Jika jawaban tidak ada di konteks, katakan dengan jujur bahwa informasi tidak ditemukan. "
        "Jangan menebak atau mengarang detail. "
        "Untuk pertanyaan jumlah/list, jawab konservatif: hanya hitung item yang benar-benar terlihat eksplisit di konteks. "
        "Jika datanya tidak lengkap, katakan bahwa jumlah pasti belum bisa dipastikan dari konteks yang tersedia. "
        "Gunakan bahasa Indonesia yang ringkas dan jelas."
    )
    user_prompt = f"Pertanyaan:\n{question}\n\nKonteks:\n{context}"

    if settings.llm_provider == "ollama":
        client = Client(host=settings.ollama_base_url)
        response = client.chat(
            model=settings.ollama_chat_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            options={
                "num_predict": settings.ollama_num_predict,
                "temperature": settings.ollama_temperature,
            },
        )
        return response["message"]["content"]

    if settings.llm_provider == "openai_compat":
        if not settings.openai_compat_api_key:
            return (
                "OPENAI_COMPAT_API_KEY belum diset. "
                "Isi dulu di .env lalu restart server."
            )

        payload = {
            "model": settings.openai_compat_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": settings.ollama_temperature,
            "max_tokens": settings.ollama_num_predict,
        }
        req = request.Request(
            url=f"{settings.openai_compat_base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.openai_compat_api_key}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        choices = body.get("choices", [])
        if not choices:
            return "Model tidak mengembalikan output (choices kosong)."

        first = choices[0]
        content = (first.get("message", {}) or {}).get("content", "")
        if not content:
            # Some OpenAI-compatible servers return plain `text`.
            content = first.get("text", "")
        if not content:
            return "Model tidak mengembalikan teks jawaban. Coba model lain atau naikkan max_tokens."
        return content

    return "LLM provider belum dikenali. Gunakan 'ollama' atau 'openai_compat'."


def retrieve_best_faq(question: str) -> dict | None:
    faqs = fetch_all_faqs()
    if not faqs:
        return None

    q_vec = embed_text(question)
    best_item: dict | None = None
    best_score = -1.0

    for faq in faqs:
        faq_question = (faq.get("question") or "").strip()
        if not faq_question:
            continue
        faq_vec = embed_text(faq_question)
        score = cosine_similarity(q_vec, faq_vec)
        if score > best_score:
            best_score = score
            best_item = faq

    if not best_item or best_score < settings.faq_min_score:
        return None

    return {
        "document_id": best_item["document_id"],
        "source_page": best_item.get("source_page"),
        "question": best_item["question"],
        "answer": best_item["answer"],
        "score": best_score,
    }


def answer_question(question: str) -> dict:
    try:
        top_faq = retrieve_best_faq(question)
    except Exception as exc:
        return {
            "answer": (
                "FAQ retrieval gagal saat embedding query. "
                f"Detail: {type(exc).__name__}: {exc}"
            ),
            "sources": [],
        }

    if top_faq:
        return {
            "answer": top_faq["answer"],
            "sources": [
                {
                    "document_id": top_faq["document_id"],
                    "page_number": top_faq["source_page"],
                    "score": top_faq["score"],
                    "source_type": "faq",
                }
            ],
        }

    try:
        top_chunks = retrieve_top_k(question, k=settings.rag_top_k)
    except Exception as exc:
        return {
            "answer": (
                "Retrieval gagal saat embedding query. "
                f"Detail: {type(exc).__name__}: {exc}"
            ),
            "sources": [],
        }

    if not top_chunks or top_chunks[0]["score"] < settings.rag_min_score:
        return {
            "answer": "Maaf, saya belum menemukan konteks yang cukup relevan di dokumen.",
            "sources": [],
        }

    context = build_context(top_chunks)
    answer = generate_answer(question, context)
    return {
        "answer": answer,
        "sources": [
            {
                "document_id": c["document_id"],
                "page_number": c["page_number"],
                "score": c["score"],
                "source_type": "chunk",
            }
            for c in top_chunks
        ],
    }
