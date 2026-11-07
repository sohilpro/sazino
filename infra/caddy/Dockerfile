# Caddy با افزونه‌ی DNS برای گواهی wildcard (DNS-01).
# برای ارائه‌دهنده‌ی DNS دیگر، فقط ماژول را عوض کن (فهرست: https://github.com/caddy-dns)
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy