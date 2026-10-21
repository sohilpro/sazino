import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';

interface PrismaLikeError {
  code: string;
  meta?: unknown;
}

export function isPrismaError(err: unknown): err is PrismaLikeError {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

export function isUniqueViolation(err: unknown): boolean {
  return isPrismaError(err) && err.code === 'P2002';
}

/** خطاهای شناخته‌شده‌ی Prisma را به خطای HTTP مناسب تبدیل می‌کند */
export function mapPrismaError(err: unknown): HttpException | null {
  if (!isPrismaError(err)) return null;

  switch (err.code) {
    case 'P2002': {
      const meta = JSON.stringify(err.meta ?? '').toLowerCase();
      if (meta.includes('slug')) return new ConflictException('این slug قبلاً استفاده شده است');
      if (meta.includes('sku')) return new ConflictException('این SKU قبلاً استفاده شده است');
      return new ConflictException('مقدار تکراری است');
    }
    case 'P2025':
      return new NotFoundException('مورد درخواستی پیدا نشد');
    case 'P2003':
      return new ConflictException('این مورد به داده‌های دیگری وابسته است');
    default:
      return null;
  }
}