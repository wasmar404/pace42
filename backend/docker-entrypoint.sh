#!/bin/sh
set -eu

if [ -n "${DB_HOST:-}" ] && [ -n "${DB_PORT:-}" ]; then
  echo "[backend] waiting for db at ${DB_HOST}:${DB_PORT}"
  while ! nc -z "${DB_HOST}" "${DB_PORT}" >/dev/null 2>&1; do
    sleep 1
  done
fi

echo "[backend] prisma generate"
npx prisma generate

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[backend] prisma db push"
  npx prisma db push
fi

exec "$@"
