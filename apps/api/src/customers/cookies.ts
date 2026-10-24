import type { Request, Response } from 'express';

export function readCookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined;
}

export function writeCookie(res: Response, name: string, value: string, days: number, secure: boolean) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function dropCookie(res: Response, name: string) {
  res.clearCookie(name, { path: '/' });
}