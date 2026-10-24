import type { Response } from 'supertest';

export function setCookieLines(res: Response): string[] {
  const header = res.headers['set-cookie'] as unknown;
  if (Array.isArray(header)) return header as string[];
  return typeof header === 'string' ? [header] : [];
}

export const cookieLine = (res: Response, name: string) =>
  setCookieLines(res).find((c) => c.startsWith(`${name}=`));

/** مقدار کوکی؛ undefined اگر ست نشده یا پاک شده باشد */
export function cookieValue(res: Response, name: string): string | undefined {
  const line = cookieLine(res, name);
  if (!line) return undefined;
  const value = line.split(';')[0]!.slice(name.length + 1);
  return value === '' ? undefined : value;
}

export const cookieHeader = (pairs: Record<string, string | undefined>) =>
  Object.entries(pairs)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
