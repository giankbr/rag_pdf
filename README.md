# RAG Chatbot PDF (Python + MySQL)

Starter project buat belajar bikin chatbot RAG dari dokumen PDF dan FAQ.

## Goal
- Ingest PDF ke chunk teks
- Simpan embedding + metadata ke MySQL
- Query user -> retrieve context relevan -> generate jawaban
- Fallback/boost jawaban dari FAQ yang diambil dari PDF

## Quick Start
1. Buat virtual env
2. Install dependency di `requirements.txt`
3. Copy `.env.example` jadi `.env`
4. Jalanin ingestion script
5. Jalanin API chatbot

## Structure
- `app/` kode aplikasi utama
- `data/raw_pdfs/` taruh file PDF asli
- `data/processed/` hasil ekstraksi/chunk sementara
- `docs/` plan belajar dan implementasi
- `scripts/` helper script (init db, migrate ringan, dsb)
- `tests/` unit/integration tests
