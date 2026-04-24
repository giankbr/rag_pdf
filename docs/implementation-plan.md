# Implementation Plan - RAG PDF Chatbot

## 1) Scope Belajar (MVP dulu)
- Input: 1-5 PDF
- Output: API chat sederhana
- Fitur inti:
  - parse PDF
  - chunk text
  - generate embedding
  - simpan ke MySQL
  - retrieve top-k context
  - jawab pertanyaan user pakai context + FAQ

## 2) Arsitektur Ringkas
- **Ingestion pipeline**
  - PDF loader -> text cleaner -> chunker -> embedder -> MySQL store
- **Serving pipeline**
  - user question -> embed query -> similarity search di MySQL -> prompt builder -> LLM response
- **FAQ layer**
  - table FAQ (question, answer, source_page)
  - bisa diprioritaskan kalau similarity tinggi ke FAQ

## 3) Milestone
1. Setup project + MySQL schema
2. Parsing PDF & chunking
3. Embedding + storage
4. Retrieval function
5. Chat endpoint
6. Evaluasi basic (5-10 pertanyaan)

## 4) Catatan MySQL untuk Vector
Pilihan:
- Simpan vector sebagai JSON lalu hitung cosine manual di app (mudah buat belajar)
- Atau pakai extension/vector support (lebih advanced, cek versi MySQL lo)

Untuk fase belajar, mulai dari JSON + reranking di Python dulu biar konsepnya kebayang.

## 5) Struktur Tabel (MVP)
- `documents`
  - `id`, `title`, `file_name`, `created_at`
- `chunks`
  - `id`, `document_id`, `page_number`, `chunk_index`, `content`, `embedding_json`
- `faqs`
  - `id`, `document_id`, `question`, `answer`, `source_page`

## 6) Prompting Strategy
- System prompt: jawab hanya dari context
- Kalau context kurang: bilang tidak menemukan di dokumen
- Tambahin citation sederhana: judul dokumen + page

## 7) Next Improvement (setelah MVP)
- Hybrid search (keyword + vector)
- Conversation memory pendek
- Feedback loop jawaban user (thumbs up/down)
- Cache query populer
