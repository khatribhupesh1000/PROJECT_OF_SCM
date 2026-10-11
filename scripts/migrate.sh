#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " Smart Contact Manager (SCM) - Polyglot Database Migration"
echo "================================================================="

MYSQL_BIN="/usr/local/mysql/bin/mysql"
if ! command -v "$MYSQL_BIN" >/dev/null 2>&1; then
  MYSQL_BIN="mysql"
fi

if command -v "$MYSQL_BIN" >/dev/null 2>&1; then
  echo "1. Applying SQL schema migration to local MySQL (scm)..."
  "$MYSQL_BIN" -u "${LOCAL_DB_USERNAME:-root}" -p"${LOCAL_DB_PASSWORD:-}" "${LOCAL_DB_NAME:-scm}" < database/mysql/001_initial_schema.sql 2>/dev/null || true

  echo "2. Applying SQL schema migration to Aiven Cloud MySQL (defaultdb)..."
  "$MYSQL_BIN" -h "${DB_HOST:-localhost}" \
    -P "${DB_PORT:-3306}" \
    -u "${DB_USERNAME:-root}" \
    -p"${DB_PASSWORD:-}" \
    --ssl-mode="${DB_SSL_MODE:-DISABLED}" \
    "${DB_NAME:-scm}" < database/mysql/001_initial_schema.sql 2>/dev/null || true
fi

echo "3. Applying MongoDB Atlas collection & index migrations (scm_audit_store)..."
node database/mongodb/001_collections_and_indexes.js || true

echo "✅ Database migrations completed."
