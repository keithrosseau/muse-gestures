#!/bin/bash
# ============================================================
# start-kiosk.sh — запуск Gestures → VCV в kiosk-режиме для выставки
# ============================================================
# Что делает:
#   1. Запускает Next.js production-сервер (next start) на порту 3000
#   2. Открывает Chromium/Chrome в fullscreen kiosk-режиме на http://localhost:3000
#   3. Отключает скринсейвер
#   4. Автоматически перезапускает браузер при падении
#
# Требования:
#   - Linux + X11 (Ubuntu/Debian/Mint) или macOS
#   - Установленный Node.js 18+ и Chromium/Chrome
#   - Проект должен быть собран: `bun run build` (или `npm run build`)
# ============================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
URL="http://localhost:${PORT}"
LOG_FILE="${PROJECT_DIR}/kiosk.log"
PID_FILE="${PROJECT_DIR}/kiosk.pid"

echo "=== Gestures → VCV — Kiosk Mode ==="
echo "Project: ${PROJECT_DIR}"
echo "URL: ${URL}"
echo ""

# --- 1. Проверяем что build существует ---
if [ ! -d "${PROJECT_DIR}/.next" ]; then
  echo "[ERROR] .next/ not found. Run 'bun run build' first."
  exit 1
fi

# --- 2. Убиваем старые процессы если есть ---
if [ -f "${PID_FILE}" ]; then
  echo "[INFO] Stopping previous kiosk instance..."
  OLD_PID=$(cat "${PID_FILE}")
  kill "${OLD_PID}" 2>/dev/null || true
  rm -f "${PID_FILE}"
  sleep 2
fi

# --- 3. Отключаем скринсейвер (Linux X11) ---
if command -v xset >/dev/null 2>&1; then
  echo "[INFO] Disabling screensaver..."
  xset s off          # отключить скринсейвер
  xset s noblank      # не blank-ить экран
  xset -dpms          # отключить power management
fi

# --- 4. Запускаем Next.js production-сервер ---
echo "[INFO] Starting Next.js production server..."
cd "${PROJECT_DIR}"
nohup bun run start > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"
echo "[INFO] Server PID: ${SERVER_PID}, log: ${LOG_FILE}"

# Ждём пока сервер поднимется
echo -n "[INFO] Waiting for server..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "${URL}" 2>/dev/null | grep -q "200"; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
  if [ $i -eq 30 ]; then
    echo " FAILED"
    echo "[ERROR] Server didn't start in 30s. Check ${LOG_FILE}"
    exit 1
  fi
done

# --- 5. Определяем браузер ---
BROWSER=""
BROWSER_ARGS="--kiosk --noerrdialogs --disable-translate --no-first-run --no-default-browser-check --disable-features=TranslateUI --autoplay-policy=no-user-gesture-required --start-fullscreen"

if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER="chromium"
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER="google-chrome"
elif command -v google-chrome-stable >/dev/null 2>&1; then
  BROWSER="google-chrome-stable"
elif [ "$(uname)" = "Darwin" ] && [ -d "/Applications/Google Chrome.app" ]; then
  BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
else
  echo "[ERROR] No Chromium/Chrome found. Install: sudo apt install chromium-browser"
  exit 1
fi
echo "[INFO] Browser: ${BROWSER}"

# --- 6. Запускаем браузер в kiosk-режиме (с авто-restart) ---
echo "[INFO] Starting browser in kiosk mode..."
echo "[INFO] Press Ctrl+C to stop."
echo ""

# Auto-restart loop: если браузер упал, перезапускаем через 2 секунды
while true; do
  "${BROWSER}" ${BROWSER_ARGS} "${URL}" || true
  echo "[WARN] Browser exited, restarting in 2s..."
  sleep 2
done
