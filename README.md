# RAG Chatbot PDF (Python + MySQL)

Starter project buat belajar bikin chatbot RAG dari dokumen PDF dan FAQ.

## Goal
- Ingest PDF ke chunk teks
- Simpan embedding + metadata ke MySQL
- Query user -> retrieve context relevan -> generate jawaban
- Prioritaskan jawaban FAQ jika kemiripan tinggi, fallback ke RAG chunk

## Quick Start
1. Buat virtual env
2. Install dependency di `requirements.txt`
3. Copy `.env.example` jadi `.env`
4. Pastikan MySQL jalan dan database `rag_pdf` sudah dibuat
5. Taruh PDF di `data/raw_pdfs/`
6. Jalanin ingestion script
7. Jalanin API chatbot

### Commands
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Ingest 1 PDF contoh:
```bash
python scripts/ingest_one.py
```

Jalankan API:
```bash
bash scripts/run_api.sh
```

Cek health:
```bash
curl http://127.0.0.1:8000/health
```

Contoh chat:
```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Apa itu API SIAPDIK?"}'
```

Jalankan unit test:
```bash
pytest -q
```

## Structure
- `app/` kode aplikasi utama
- `data/raw_pdfs/` taruh file PDF asli
- `data/processed/` hasil ekstraksi/chunk sementara
- `docs/` plan belajar dan implementasi
- `scripts/` helper script (init db, migrate ringan, dsb)
- `tests/` unit/integration tests
