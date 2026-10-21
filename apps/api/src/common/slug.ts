/** حروف (هر زبانی) و عدد، با خط تیره بین بخش‌ها */
export const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
export const SLUG_MAX_LENGTH = 80;

export function slugify(input: string, maxLength = SLUG_MAX_LENGTH): string {
  return input
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ارقام عربی
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ارقام فارسی
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '') // اعراب و کشیده
    .replace(/[^\p{L}\p{N}]+/gu, '-') // فاصله، نیم‌فاصله و علائم
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** ریشه‌ی slug با جا برای پسوند «-N»؛ اگر چیزی نماند fallback برمی‌گردد */
export function slugRoot(text: string, fallback: string): string {
  const root = slugify(text).slice(0, SLUG_MAX_LENGTH - 6).replace(/-+$/g, '');
  return root || fallback;
}

export function pickUniqueSlug(root: string, taken: ReadonlySet<string>): string {
  if (!taken.has(root)) return root;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}