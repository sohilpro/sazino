-- روز ۲۰ (ب): Row Level Security
--
-- لایه‌ی دفاعی دوم جداسازی tenantها در خود دیتابیس. فیلتر tenantId در کلاینت tenant (TENANT_DB) سر جایش
-- می‌ماند؛ این migration تضمین می‌کند حتی با باگ در برنامه، نقش «myapp_tenant» هیچ ردیفی از tenant دیگر
-- را نبیند و ننویسد.
--
-- طراحی:
--  * myapp_tenant: نقش گروهی بدون ورود (NOLOGIN) و بدون BYPASSRLS. کاربر ورود واقعی (مثلاً myapp_rls)
--    با «npm run db:tenant-role» ساخته می‌شود و عضو این گروه است (رمز در git نیست).
--  * مالک جدول‌ها / نقش سیستمی (DATABASE_URL) مثل قبل RLS را دور می‌زند (احراز هویت، resolver، سوپر ادمین، jobها).
--  * مقدار app.tenant_id در هر تراکنش با set_config(..., true) گذاشته می‌شود. تنظیم‌نشده = هیچ ردیفی.
--  * NULLIF: بعد از پایان تراکنش مقدار خالی می‌ماند و تبدیل '' به uuid خطا می‌داد.
--  * جدول‌های سیستمی (refresh_tokens، plans، platform_admins، admin_sessions، admin_audit_logs) هیچ دسترسی
--    برای نقش tenant ندارند.
--  * جدول تازه‌ی دارای tenant_id: نامش را به این فهرست در یک migration جدید اضافه کنید؛
--    تست rls-schema اگر فراموش شود قرمز می‌شود.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'myapp_tenant') THEN
    CREATE ROLE myapp_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO myapp_tenant', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO myapp_tenant;

-- tenants: فقط خواندنِ رکورد خودِ tenant
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON "tenants" FOR SELECT TO myapp_tenant
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT ON "tenants" TO myapp_tenant;

-- جدول‌های دارای tenant_id: خواندن و نوشتن فقط برای ردیف‌های tenant جاری
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
        'users', 'domains', 'categories', 'products',
        'variants', 'inventory', 'media', 'product_images',
        'customers', 'customer_sessions', 'carts', 'cart_items',
        'shipping_methods', 'customer_addresses', 'order_counters', 'orders',
        'order_items', 'payment_gateway_configs', 'payments', 'pages'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $policy$CREATE POLICY tenant_isolation ON %I TO myapp_tenant
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)$policy$,
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO myapp_tenant', t);
  END LOOP;
END
$$;