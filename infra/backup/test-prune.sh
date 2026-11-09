#!/bin/sh
# اجرا: sh infra/backup/test-prune.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
mkdir -p "$dir/db"

# برای هر یک از ۳۰۰ روز گذشته یک نسخه می‌سازیم
i=0
while [ "$i" -le 300 ]; do
  stamp=$(date -u -d "$i days ago" +%Y%m%dT%H%M%SZ)
  touch "$dir/db/myapp-$stamp.dump" "$dir/db/myapp-$stamp.dump.sha256"
  i=$((i + 1))
done

BACKUP_DIR="$dir" sh "$here/prune.sh" >/dev/null

fail() { echo "FAIL: $1"; exit 1; }
now=$(date -u +%s)
kept=0
weekly=0
for f in "$dir"/db/myapp-*.dump; do
  base=${f##*/}; ymd=${base#myapp-}; ymd=${ymd%%T*}
  ts=$(date -u -d "$(echo "$ymd" | cut -c1-4)-$(echo "$ymd" | cut -c5-6)-$(echo "$ymd" | cut -c7-8) 00:00:00" +%s)
  age=$(( (now - ts) / 86400 ))
  dow=$(date -u -d "@$ts" +%u)
  dom=$(echo "$ymd" | cut -c7-8)
  kept=$((kept + 1))
  [ "$age" -le 186 ] || fail "kept a backup older than 186 days ($base)"
  if [ "$age" -gt 7 ]; then
    [ "$dow" = "7" ] || [ "$dom" = "01" ] || fail "kept a non-weekly backup older than 7 days ($base)"
  fi
  if [ "$age" -gt 35 ]; then
    [ "$dom" = "01" ] || fail "kept an old backup that is not the 1st of a month ($base)"
  fi
  if [ "$age" -gt 7 ] && [ "$age" -le 35 ] && [ "$dow" = "7" ]; then weekly=$((weekly + 1)); fi
done

# همه‌ی ۸ روز اخیر (۰ تا ۷) باید مانده باشند
i=0
while [ "$i" -le 7 ]; do
  stamp=$(date -u -d "$i days ago" +%Y%m%d)
  ls "$dir"/db/myapp-"$stamp"T*.dump >/dev/null 2>&1 || fail "recent backup ($i days ago) was pruned"
  i=$((i + 1))
done

[ "$weekly" -ge 3 ] || fail "expected at least 3 weekly backups, got $weekly"
[ "$kept" -le 25 ] || fail "kept too many backups: $kept"
[ -e "$dir/db/myapp-$(date -u +%Y%m%d)"T*.dump ] || fail "newest backup was removed"
echo "PASS: retention kept $kept backups ($weekly weekly)"