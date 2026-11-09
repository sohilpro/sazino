import type { PrismaClient } from '../generated/prisma/client';

/**
 * تنوع‌های سفارش را تا پایان تراکنش «FOR SHARE» قفل می‌کند: خواندن آزاد است ولی فروشنده
 * نمی‌تواند قیمت همین تنوع‌ها را وسط ثبت سفارش عوض کند. ids مرتب می‌شوند تا ترتیب قفل ثابت بماند.
 * SQL خام از فیلتر خودکار tenant رد نمی‌شود؛ به همین دلیل tenant_id صریح است.
 */
export async function lockVariantsForShare(
  tx: { $queryRaw: PrismaClient['$queryRaw'] },
  tenantId: string,
  variantIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(variantIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM variants
    WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${ids}::uuid[])
    ORDER BY id
    FOR SHARE`;
}