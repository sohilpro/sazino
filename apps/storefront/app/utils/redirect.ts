/** فقط مسیرهای داخلی پذیرفته می‌شود (جلوگیری از open redirect) */
export function safeRedirect(value: unknown, fallback = '/'): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.includes('\\')
    ? v
    : fallback;
}