# توابع مشترک اسکریپت‌های پشتیبان (با «.» وارد می‌شود)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_DIR="$BACKUP_DIR/db"
PGHOST="${PGHOST:-postgres}"
export PGHOST

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [backup] $*"; }

alert() {
  [ -n "${ALERT_WEBHOOK_URL:-}" ] || return 0
  curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
    -d "{\"text\":\"$1\"}" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
}