import { ConflictException } from '@nestjs/common';

/** خطای 409 با کد قابل‌خواندن برای ماشین (فرانت بر اساس code تصمیم می‌گیرد) */
export function conflict(code: string, message: string, extra: Record<string, unknown> = {}) {
  return new ConflictException({ statusCode: 409, error: 'Conflict', code, message, ...extra });
}