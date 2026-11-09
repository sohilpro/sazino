#!/bin/sh
set -eu
. /usr/local/bin/lib.sh

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}"
mkdir -p "$DB_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP="$DB_DIR/.tmp-$STAMP.dump"
FINAL="$DB_DIR/myapp-$STAMP.dump"

on_exit() {
  rc=$?
  if [ "$rc" -ne 0 ]; then
    rm -f "$TMP"
    log "FAILED (exit $rc)"
    alert "❌ پشتیبان‌گیری ناموفق بود ($(hostname)، کد $rc)"
  fi
}
trap on_exit EXIT

log "dumping $POSTGRES_DB"
pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  --format=custom --compress=6 --no-owner --file="$TMP"
# فایل خراب همین‌جا معلوم می‌شود
pg_restore --list "$TMP" >/dev/null
mv "$TMP" "$FINAL"
sha256sum "$FINAL" | sed "s#$DB_DIR/##" > "$FINAL.sha256"
log "saved $(basename "$FINAL") ($(du -h "$FINAL" | cut -f1))"

# تصاویر (MinIO): آینه‌ی ساده؛ حذف فایل در مبدأ، در نسخه‌ی بعدی به آینه هم می‌رسد
if [ "${BACKUP_MEDIA:-false}" = "true" ] && [ -d /media-src ]; then
  mkdir -p "$BACKUP_DIR/media"
  rsync -a --delete /media-src/ "$BACKUP_DIR/media/"
  log "media mirrored"
fi

# کپی بیرون از سرور؛ فقط رمزشده
if [ -n "${BACKUP_REMOTE:-}" ]; then
  if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
    log "refusing to send an unencrypted backup off-site (set BACKUP_AGE_RECIPIENT)"
    exit 1
  fi
  age -r "$BACKUP_AGE_RECIPIENT" -o "$FINAL.age" "$FINAL"
  rsync -a \
    -e "ssh -i /etc/backup/id_ed25519 -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/etc/backup/known_hosts" \
    "$FINAL.age" "$BACKUP_REMOTE/db/"
  rm -f "$FINAL.age"
  log "copied off-site (encrypted)"
fi

/usr/local/bin/prune.sh
date +%s > "$BACKUP_DIR/.last-backup-ok"