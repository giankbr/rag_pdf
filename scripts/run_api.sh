#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

APP_PORT="${APP_PORT:-8010}"
if [ -x ".venv/bin/python" ]; then
  .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT}" --reload
else
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT}" --reload
fi
