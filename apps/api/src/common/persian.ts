/** ي/ك/ى عربی را به ی/ک فارسی تبدیل و فاصله‌ها را مرتب می‌کند */
export function normalizePersian(input: string): string {
  return input
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}