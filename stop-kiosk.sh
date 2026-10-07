#!/bin/bash
# ============================================================
# stop-kiosk.sh — остановка kiosk-режима
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="${PROJECT_DIR}/kiosk.pid"

echo "=== Stopping Gestures → VCV kiosk ==="

# 1. Убиваем Next.js сервер
if [ -f "${PID_FILE}" ]; then
  PID=$(cat "${PID_FILE}")
  echo "[INFO] Stopping server (PID ${PID})..."
  kill "${PID}" 2>/dev/null || true
  # Убиваем всё что слушает порт 3000
  fuser -k 3000/tcp 2>/dev/null || true
  rm -f "${PID_FILE}"
fi

# 2. Убиваем браузер
for proc in chromium-browser chromium google-chrome google-chrome-stable "Google Chrome"; do
  pkill -f "$proc" 2>/dev/null || true
done

# 3. Возвращаем скринсейвер (опционально)
if command -v xset >/dev/null 2>&1; then
  echo "[INFO] Re-enabling screensaver..."
  xset s on
  xset +dpms
fi

echo "[OK] Kiosk stopped."
