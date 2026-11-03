/** حداقل فاصله‌ی دو بررسی DNS برای یک دامنه */
export const VERIFY_COOLDOWN_MS = 10_000;
/** بعد از این‌همه بررسی روزانه‌ی ناموفق پشت‌سرهم، دامنه غیرفعال می‌شود */
export const REVALIDATE_MAX_FAILURES = 3;
export const PENDING_DOMAIN_TTL_MS = 14 * 24 * 60 * 60 * 1000;