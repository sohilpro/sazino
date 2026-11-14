# چک‌لیست امنیتی (قبل از لانچ و هر سه ماه)

## رمزها و کلیدها
- [ ] `JWT_ACCESS_SECRET`، `INTERNAL_API_TOKEN`، رمز Postgres/Redis/MinIO تصادفی و ≥۳۲ کاراکتر
- [ ] رمز قدیمی ملی‌پیامک (که لو رفته) عوض شده
- [ ] `ENCRYPTION_KEY` در جای امن پشتیبان‌گیری شده (گم‌شدن = فروشنده‌ها باید شناسه‌ی درگاه را دوباره وارد کنند)
- [ ] `.env.production` فقط روی سرور، `chmod 600`، خارج از git
- [ ] توکن GHCR سرور فقط `read:packages` دارد

## شبکه و سرور
- [ ] ufw فقط 22 (ترجیحاً محدود به IP شما)، 80، 443
- [ ] ورود SSH فقط با کلید؛ root غیرفعال
- [ ] فقط Caddy پورت منتشر می‌کند (`docker ps` را بررسی کن)
- [ ] ADMIN_ALLOWED_IPS درست است؛ `/admin` و `/api/admin/*` از IP دیگر ۴۰۴ می‌دهد
- [ ] `/api/internal/*` از بیرون ۴۰۴ می‌دهد؛ `smoke.sh` کامل PASS
- [ ] رکورد DNS در Cloudflare «DNS only» است

## برنامه
- [ ] `REQUIRE_PROXY_TOKEN`، `RATE_LIMIT_ENABLED`، `CACHE_ENABLED` در پروداکشن true
- [ ] درایور پیامک `melipayamak`، درگاه `zarinpal`؛ `ZARINPAL_SANDBOX=false` فقط بعد از تست ۱٬۰۰۰ تومانی
- [ ] Swagger (`/docs`) در پروداکشن در دسترس نیست
- [ ] هیچ لاگی شامل رمز، توکن یا شماره‌ی کامل موبایل نیست (نمونه‌ی `docker logs api` را بررسی کن)
- [ ] تست حسابرسی کنترلرها و تست استفاده از `PrismaService` سبزند

## داده و بازیابی
- [ ] پشتیبان شبانه ساخته می‌شود (`/backups/.last-backup-ok` امروز است)
- [ ] تست بازیابی هفتگی سبز است (`/backups/last-restore-test.json`)
- [ ] یک نسخه‌ی رمزشده بیرون از سرور هست و کلید `age` جایی جز همان سرور نگه‌داری می‌شود
- [ ] تمرین بازیابی کامل حداقل یک‌بار انجام شده
- [ ] `TENANT_DATABASE_URL` روی نقش `myapp_rls` (بدون BYPASSRLS) است؛ `npm run db:tenant-role` در دیپلوی
- [ ] `TENANT_DATABASE_URL` روی نقش `myapp_rls` (بدون BYPASSRLS) است؛ `npm run db:tenant-role` در دیپلوی اجرا شده و لاگ API می‌گوید «row level security enforced»
- [ ] تست‌های `rls` و `rls-schema` سبزند (هر جدول تازه‌ی دارای tenant_id باید در یک migration جدید policy بگیرد)

## مانیتورینگ
- [ ] `GET /api/health` با نسخه‌ی درست و `worker: up` جواب می‌دهد
- [ ] یک مانیتور بیرونی روی `/api/health` (مثلاً Uptime Kuma) و هشدار روشن است
- [ ] DSN Sentry/GlitchTip تنظیم و یک خطای آزمایشی دیده شده
- [ ] `npm audit --omit=dev --audit-level=high` بدون مورد باز

## قبل از لانچ
- [ ] تست E2E مسیر خرید سبز
- [ ] ادمین واقعی با `admin:create`؛ حساب‌های seed (`admin@platform.test` و ...) در پروداکشن ساخته نشده‌اند
- [ ] بخش ب (RLS) انجام شده