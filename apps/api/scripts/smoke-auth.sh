#!/usr/bin/env bash
# تست دودی کامل احراز هویت؛ نیاز به اجرای API دارد
set -uo pipefail

API="${API:-http://localhost:4000/api}"
N="$RANDOM$RANDOM"
EMAIL="smoke$N@example.com"
SUB="smoke$N"
JAR=$(mktemp)
OLD=$(mktemp)
LOGGED_IN=$(mktemp)
JSON='Content-Type: application/json'
FAIL=0

check() {
  local label="$1" expected="$2"; shift 2
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" = "$expected" ]; then echo "✔ $label ($got)"; else echo "✘ $label: expected $expected, got $got"; FAIL=1; fi
}

BODY="{\"storeName\":\"Smoke Store\",\"subdomain\":\"$SUB\",\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"Password123!\"}"

RES=$(curl -s -c "$JAR" -X POST "$API/auth/register" -H "$JSON" -d "$BODY")
TOKEN=$(echo "$RES" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then echo "✔ register (token received)"; else echo "✘ register failed: $RES"; exit 1; fi

check "me with token"            200 "$API/auth/me" -H "Authorization: Bearer $TOKEN"
check "me without token"         401 "$API/auth/me"
check "users list as OWNER"      200 "$API/users" -H "Authorization: Bearer $TOKEN"
check "duplicate subdomain"      409 -X POST "$API/auth/register" -H "$JSON" \
  -d "{\"storeName\":\"Other Store\",\"subdomain\":\"$SUB\",\"name\":\"Other User\",\"email\":\"other$N@example.com\",\"password\":\"Password123!\"}"
check "subdomain taken"          200 "$API/auth/check-subdomain?subdomain=$SUB"
check "duplicate email"          409 -X POST "$API/auth/register" -H "$JSON" \
  -d "{\"storeName\":\"Other Store\",\"subdomain\":\"other$N\",\"name\":\"Other User\",\"email\":\"$EMAIL\",\"password\":\"Password123!\"}"
check "reserved subdomain"       400 -X POST "$API/auth/register" -H "$JSON" \
  -d "{\"storeName\":\"Other Store\",\"subdomain\":\"admin\",\"name\":\"Other User\",\"email\":\"third$N@example.com\",\"password\":\"Password123!\"}"

cp "$JAR" "$OLD"
check "refresh (rotation)"       200 -b "$JAR" -c "$JAR" -X POST "$API/auth/refresh"
check "refresh with OLD cookie (reuse)" 401 -b "$OLD" -X POST "$API/auth/refresh"
check "refresh with NEW cookie after reuse (family revoked)" 401 -b "$JAR" -X POST "$API/auth/refresh"

check "wrong password"           401 -X POST "$API/auth/login" -H "$JSON" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass123\"}"
check "login"                    200 -c "$JAR" -X POST "$API/auth/login" -H "$JSON" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Password123!\"}"

cp "$JAR" "$LOGGED_IN"
check "logout"                   204 -b "$JAR" -c "$JAR" -X POST "$API/auth/logout"
check "refresh after logout"     401 -b "$LOGGED_IN" -X POST "$API/auth/refresh"

rm -f "$JAR" "$OLD" "$LOGGED_IN"
[ "$FAIL" = 0 ] && echo -e "\nAll checks passed ✅" || { echo -e "\nSome checks failed ❌"; exit 1; }