#!/usr/bin/env bash
# ============================================================
# Run all database setup scripts in order.
# Usage:
#   ./run-all.sh
#   MYSQL_PASSWORD=secret ./run-all.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-1234}"

MYSQL="mysql -h${MYSQL_HOST} -P${MYSQL_PORT} -u${MYSQL_USER} -p${MYSQL_PASSWORD}"

echo "▶  01-create-databases.sql ..."
$MYSQL < "${SCRIPT_DIR}/01-create-databases.sql"

echo "▶  02-schema-and-seed.sql ..."
$MYSQL < "${SCRIPT_DIR}/02-schema-and-seed.sql"

echo "✓  All scripts executed successfully."
