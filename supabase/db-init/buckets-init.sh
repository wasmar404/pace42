#!/bin/sh
set -e

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDB="${PGDB:-postgres}"

AVATARS_BUCKET="${SUPABASE_AVATARS_BUCKET:-test}"
ACTIVITY_MEDIA_BUCKET="${SUPABASE_ACTIVITY_MEDIA_BUCKET:-activity-media}"
GPX_BUCKET="${SUPABASE_GPX_BUCKET:-gpx}"

export PGPASSWORD

# Wait until storage.buckets table exists (storage service runs migrations on startup)
echo "[buckets-init] waiting for storage.buckets table..."
until psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets'" | grep -q 1; do
  sleep 2
done

echo "[buckets-init] creating buckets: $AVATARS_BUCKET, $ACTIVITY_MEDIA_BUCKET, $GPX_BUCKET"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" <<SQL
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('${AVATARS_BUCKET}',        '${AVATARS_BUCKET}',        true),
  ('${ACTIVITY_MEDIA_BUCKET}', '${ACTIVITY_MEDIA_BUCKET}', true),
  ('${GPX_BUCKET}',            '${GPX_BUCKET}',            false)
ON CONFLICT (id) DO NOTHING;
SQL

echo "[buckets-init] applying storage RLS policies..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -f /sql/storage-policies.sql

echo "[buckets-init] done."
