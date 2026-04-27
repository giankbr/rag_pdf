import json
from typing import Any

import numpy as np

from app.db.mysql_client import fetch_all_chunks
from app.rag.ingest import embed_text


def cosine_similarity(a: list[float], b: list[float]) -> float:
    max_len = max(len(a), len(b))
    va = np.array(a + [0.0] * (max_len - len(a)))
    vb = np.array(b + [0.0] * (max_len - len(b)))
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def retrieve_top_k(question: str, k: int = 3, document_id: int | None = None) -> list[dict[str, Any]]:
    q_vec = embed_text(question)
    rows = fetch_all_chunks(document_id=document_id)
    scored: list[dict[str, Any]] = []
    for row in rows:
        emb = row["embedding_json"]
        if isinstance(emb, str):
            emb = json.loads(emb)
        score = cosine_similarity(q_vec, emb)
        scored.append(
            {
                "chunk_id": row["id"],
                "document_id": row["document_id"],
                "page_number": row["page_number"],
                "content": row["content"],
                "score": score,
            }
        )
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]
