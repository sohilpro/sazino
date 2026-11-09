#!/bin/sh
# آخرین پشتیبان را در یک دیتابیس موقت بازیابی و سالم‌بودنش را بررسی می‌کند
set -eu
. /usr/local/bin/lib.sh

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}"
TESTDB="restore_test_$(date -u +%Y%m%d%H%M%S)"

fail() {
  log "RESTORE TEST FAILED: $1"
  alert "❌ تست بازیابی پشتیبان ناموفق بود: $1"
  exit 1
}

cleanup() {
  dropdb --username="$POSTGRES_USER" --if-exists --force "$TESTDB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

latest=$(ls -1 "$DB_DIR"/myapp-*.dump 2>/dev/null | sort | tail -n 1 || true)
[ -n "$latest" ] || fail "no backup files found"

(cd "$DB_DIR" && sha256sum -c "$(basename "$latest").sha256" >/dev/null) || fail "checksum mismatch for $(basename "$latest")"

createdb --username="$POSTGRES_USER" "$TESTDB"
pg_restore --username="$POSTGRES_USER" --dbname="$TESTDB" \
  --no-owner --no-privileges --exit-on-error "$latest" || fail "pg_restore failed"

q() { psql --username="$POSTGRES_USER" --dbname="$1" -tAc "$2"; }

tables=$(q "$TESTDB" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[ "$tables" -ge 20 ] || fail "only $tables tables restored"

migrations=$(q "$TESTDB" "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL") || fail "no migrations table"
[ "$migrations" -ge 1 ] || fail "no applied migrations"

live=$(q "$POSTGRES_DB" "SELECT count(*) FROM tenants")
restored=$(q "$TESTDB" "SELECT count(*) FROM tenants")
if [ "$live" -gt 0 ] && [ "$restored" -eq 0 ]; then fail "backup has no tenants but the live database has $live"; fi

date +%s > "$BACKUP_DIR/.last-restore-ok"
printf '{"ok":true,"file":"%s","tables":%s,"migrations":%s,"tenants":%s,"at":"%s"}\n' \
  "$(basename "$latest")" "$tables" "$migrations" "$restored" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$BACKUP_DIR/last-restore-test.json"
log "restore test passed: $(basename "$latest") ($tables tables, $restored tenants)"