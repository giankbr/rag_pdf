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
APP_PORT=8010 bash scripts/run_api.sh
```

Atau pakai default script (otomatis pakai 8010 jika `APP_PORT` tidak diset):
```bash
bash scripts/run_api.sh
```

Jalankan frontend (Next.js):
```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 npm run dev
```

Upload PDF dari UI:
- Klik tombol `Upload PDF` di sidebar.
- Tunggu status `berhasil diupload dan diingest`.
- Setelah selesai, PDF bisa langsung ditanya via chat.

Cek health:
```bash
curl http://127.0.0.1:8010/health
```

Contoh chat:
```bash
curl -X POST http://127.0.0.1:8010/chat \
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
