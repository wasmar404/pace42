#!/bin/sh
set -eu

if [ ! -d node_modules ]; then
  echo "[backend] installing dependencies (node_modules missing)"
  npm ci
else
  if [ ! -f node_modules/iconv-lite/encodings/index.js ]; then
    echo "[backend] reinstalling dependencies (iconv-lite encodings missing)"
    rm -rf node_modules
    npm ci
  fi
fi

if [ -n "${DB_HOST:-}" ] && [ -n "${DB_PORT:-}" ]; then
  echo "[backend] waiting for db at ${DB_HOST}:${DB_PORT}"
  while ! nc -z "${DB_HOST}" "${DB_PORT}" >/dev/null 2>&1; do
    sleep 1
  done
fi

case "${SUPABASE_URL:-}" in
  http://127.0.0.1:54321*|http://localhost:54321*)
    echo "[backend] waiting for supabase at 127.0.0.1:54321"
    while ! nc -z 127.0.0.1 54321 >/dev/null 2>&1; do
      sleep 1
    done
    ;;
esac

echo "[backend] prisma generate"
npx prisma generate

if [ "${PRISMA_DB_PUSH:-0}" = "1" ]; then
  echo "[backend] prisma db push (PRISMA_DB_PUSH=1)"
  npx prisma db push
fi

exec "$@"
