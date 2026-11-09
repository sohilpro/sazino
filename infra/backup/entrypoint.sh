#!/bin/sh
set -eu
: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${PGPASSWORD:?}"

# crond متغیرهای محیط را به کارها نمی‌دهد؛ آن‌ها را در فایل می‌نویسیم
env | grep -E '^(PGPASSWORD|POSTGRES_USER|POSTGRES_DB|BACKUP_|ALERT_|TZ)=' \
  | sed "s/'/'\\\\''/g; s/^\([^=]*\)=\(.*\)\$/export \1='\2'/" > /etc/backup.env
chmod 600 /etc/backup.env
mkdir -p "${BACKUP_DIR:-/backups}"

# اولین نسخه کمی بعد از بالا آمدن: هم تنظیمات را می‌سنجد، هم نشانگر سلامت را می‌سازد
( sleep 120; . /etc/backup.env; /usr/local/bin/backup.sh ) &

exec crond -f -l 8 -L /dev/stdout