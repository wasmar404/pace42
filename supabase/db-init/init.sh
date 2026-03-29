#!/bin/sh
set -e

PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDB="${PGDB:-postgres}"
JWT_SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
JWT_EXP="${JWT_EXP:-3600}"

export PGPASSWORD

# Wait for Postgres to be ready
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do
  echo "[db-init] waiting for postgres..."
  sleep 2
done

# Idempotency check — skip if already initialized
DB_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -tAc "SELECT 1 FROM pg_database WHERE datname = '_supabase'")
if [ "$DB_EXISTS" = "1" ]; then
  echo "[db-init] already initialized, skipping."
  exit 0
fi

echo "[db-init] initializing Supabase databases and roles..."

# 1. Create _supabase database
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "CREATE DATABASE _supabase WITH OWNER supabase_admin;"

# 2. Set service user passwords
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c "
ALTER USER authenticator       WITH PASSWORD '${PGPASSWORD}';
ALTER USER pgbouncer           WITH PASSWORD '${PGPASSWORD}';
ALTER USER supabase_auth_admin WITH PASSWORD '${PGPASSWORD}';
ALTER USER supabase_storage_admin WITH PASSWORD '${PGPASSWORD}';
"

# 3. JWT settings
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c "
ALTER DATABASE postgres SET \"app.settings.jwt_secret\" TO '${JWT_SECRET}';
ALTER DATABASE postgres SET \"app.settings.jwt_exp\" TO '${JWT_EXP}';
"

# 4. Webhooks
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -f /sql/webhooks.sql

# 5. Realtime schema (in postgres db)
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c "
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO supabase_admin;
"

# 6. Analytics + pooler schemas (in _supabase db)
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "_supabase" -c "
CREATE SCHEMA IF NOT EXISTS _analytics;
ALTER SCHEMA _analytics OWNER TO supabase_admin;
CREATE SCHEMA IF NOT EXISTS _supavisor;
ALTER SCHEMA _supavisor OWNER TO supabase_admin;
"

# 7. Fix auth schema ownership so auth service can run migrations
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c "
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.uid()   OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role()  OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
"

# 8. Grant roles to supabase_storage_admin so it can SET ROLE for RLS
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c "
GRANT service_role  TO supabase_storage_admin;
GRANT anon          TO supabase_storage_admin;
GRANT authenticated TO supabase_storage_admin;
"

echo "[db-init] done."
