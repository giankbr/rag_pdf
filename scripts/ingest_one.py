from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.mysql_client import get_connection, init_schema, insert_document
from app.rag.ingest import ingest_pdf

PDF_PATH = "data/raw_pdfs/Dokumentasi API SIAPDIK.pdf"
DOCUMENT_TITLE = "Dokumentasi API SIAPDIK"

def count_chunks(document_id: int) -> int:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT COUNT(*) FROM chunks WHERE document_id = %s
        """,
        (document_id,),
    )

    total = cur.fetchone()[0]
    cur.close()
    conn.close()
    return total


def main() -> None:
    init_schema()
    pdf = Path(PDF_PATH)
    if not pdf.exists():
        raise FileNotFoundError(f"PDF file not found: {PDF_PATH}")

    document_id = insert_document(DOCUMENT_TITLE, pdf.name)
    ingest_pdf(str(pdf), document_id=document_id)

    total_chunks = count_chunks(document_id)
    print(f"Done. document_id={document_id}, total_chunks={total_chunks}")


if __name__ == "__main__":
    main()
