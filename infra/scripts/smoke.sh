#!/usr/bin/env bash
# بعد از هر دیپلوی: ./infra/scripts/smoke.sh myapp.com demo
# (دامنه‌ی پلتفرم و ساب‌دامین یک فروشگاه واقعی)
set -u
DOMAIN="${1:?domain}"
TENANT="${2:?tenant subdomain}"
fail=0

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; fail=1; fi
}

check "API health" test "$(status "https://api.$DOMAIN/api/health")" = 200
check "internal route hidden" test "$(status "https://api.$DOMAIN/api/internal/domains/check")" = 404
check "spoofed tenant header ignored" test "$(status -H "x-tenant-host: $TENANT.$DOMAIN" "https://api.$DOMAIN/api/store")" != 200
check "dashboard up" test "$(status "https://app.$DOMAIN/")" = 200
check "HSTS on dashboard" bash -c "curl -sI https://app.$DOMAIN/ | grep -qi '^strict-transport-security'"
check "storefront home" test "$(status "https://$TENANT.$DOMAIN/")" = 200
check "CSP on storefront" bash -c "curl -sI https://$TENANT.$DOMAIN/ | grep -qi '^content-security-policy'"
check "robots has sitemap" bash -c "curl -s https://$TENANT.$DOMAIN/robots.txt | grep -q '^Sitemap: '"
check "sitemap is XML" bash -c "curl -s https://$TENANT.$DOMAIN/sitemap.xml | grep -q '<urlset'"
check "unknown store robots blocks all" bash -c "curl -s https://zz-no-such-shop.$DOMAIN/robots.txt | grep -q '^Disallow: /\$'"
check "media root is 404" test "$(status "https://media.$DOMAIN/")" = 404

exit $fail