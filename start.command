#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${META_METEO_PORT:-8000}"
URL="http://127.0.0.1:${PORT}"

if [ ! -d ".venv" ]; then
  PYTHON_BIN="$(command -v python3.12 || command -v python3.11 || command -v python3)"
  echo "Erstelle virtuelle Umgebung mit ${PYTHON_BIN} ..."
  "$PYTHON_BIN" -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
fi

echo "Starte Meta-Wetter auf ${URL} ..."
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port "${PORT}" --reload &
SERVER_PID=$!

sleep 2
open "${URL}" >/dev/null 2>&1 || true

wait "${SERVER_PID}"
