#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

OPEN_BROWSER=1

for arg in "$@"; do
  case "$arg" in
    --no-browser) OPEN_BROWSER=0 ;;
    -h|--help)
      echo "Usage: $0 [--no-browser]"
      exit 0
      ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 1 ;;
  esac
done

PORT="${META_METEO_PORT:-8000}"
URL="http://127.0.0.1:${PORT}"

if [ ! -d ".venv" ]; then
  PYTHON_BIN="$(command -v python3.12 || command -v python3.11 || command -v python3)"
  echo "Erstelle virtuelle Umgebung mit ${PYTHON_BIN} ..."
  "$PYTHON_BIN" -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
fi

if lsof -ti "tcp:${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} ist bereits belegt – MetaMeteo läuft möglicherweise schon." >&2
  echo "  Anderen Port wählen: META_METEO_PORT=8010 ./start.sh" >&2
  exit 1
fi

echo "Starte Meta-Wetter auf ${URL} ..."
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port "${PORT}" --reload &
SERVER_PID=$!
OPENER_PID=""

cleanup() {
  trap - INT TERM
  kill "$SERVER_PID" 2>/dev/null || true
  if [ -n "$OPENER_PID" ]; then
    kill "$OPENER_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Sobald der Server antwortet, den Browser öffnen.
if [ "$OPEN_BROWSER" -eq 1 ]; then
  (
    for _ in $(seq 1 60); do
      curl -fsS -m 2 "$URL" >/dev/null 2>&1 && break
      sleep 1
    done
    if command -v open >/dev/null 2>&1; then
      open "$URL" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$URL" >/dev/null 2>&1 || true
    fi
  ) &
  OPENER_PID=$!
fi

wait "${SERVER_PID}"
