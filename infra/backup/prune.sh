#!/bin/sh
# نگهداری: روزانه ۷ روز، یکشنبه‌ها ۳۵ روز، روز اول ماه ۱۸۶ روز؛ آخرین نسخه هرگز پاک نمی‌شود
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_DIR="$BACKUP_DIR/db"
KEEP_DAILY_DAYS="${KEEP_DAILY_DAYS:-7}"
KEEP_WEEKLY_DAYS="${KEEP_WEEKLY_DAYS:-35}"
KEEP_MONTHLY_DAYS="${KEEP_MONTHLY_DAYS:-186}"

now=$(date -u +%s)
newest=$(ls -1 "$DB_DIR"/myapp-*.dump 2>/dev/null | sort | tail -n 1 || true)

for f in "$DB_DIR"/myapp-*.dump; do
  [ -e "$f" ] || continue
  [ "$f" = "$newest" ] && continue

  base=${f##*/}
  ymd=${base#myapp-}
  ymd=${ymd%%T*}
  y=$(echo "$ymd" | cut -c1-4)
  m=$(echo "$ymd" | cut -c5-6)
  d=$(echo "$ymd" | cut -c7-8)
  ts=$(date -u -d "$y-$m-$d 00:00:00" +%s) || continue
  age=$(( (now - ts) / 86400 ))
  dow=$(date -u -d "$y-$m-$d 00:00:00" +%u)

  keep=0
  [ "$age" -le "$KEEP_DAILY_DAYS" ] && keep=1
  [ "$dow" = "7" ] && [ "$age" -le "$KEEP_WEEKLY_DAYS" ] && keep=1
  [ "$d" = "01" ] && [ "$age" -le "$KEEP_MONTHLY_DAYS" ] && keep=1

  if [ "$keep" = "0" ]; then
    rm -f "$f" "$f.sha256" "$f.age"
    echo "pruned $base"
  fi
done