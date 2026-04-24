from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.rag.retriever import retrieve_top_k

QUESTION = "Apa itu API SIAPDIK?"
TOP_K = 3

def main() -> None:
    results = retrieve_top_k(QUESTION, k=TOP_K)
    if not results:
        print("Belum ada hasil, pastikan chunks sudah diingest")
        return

    print(f"Question: {QUESTION}")
    print("-" * 80)

    for i, item in enumerate(results, start=1):
        preview = item["content"][:220].replace("\n", " ")
        print(
            f"{i}. score={item['score']:.4f} "
            f"doc={item['document_id']} page={item['page_number']}\n"
            f"   {preview}\n"
        )


if __name__ == "__main__":
    main()
