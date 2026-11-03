export type PlanResource = 'products' | 'domains' | 'media';

const NOUN: Record<PlanResource, string> = {
  products: 'تعداد محصولات',
  domains: 'دامنه‌ی اختصاصی',
  media: 'فضای تصاویر',
};

const FEATURE: Record<PlanResource, string> = {
  products: 'ساخت محصول',
  domains: 'دامنه‌ی اختصاصی',
  media: 'آپلود تصویر',
};

export function planLimitMessage(resource: PlanResource, planName: string, limit: number): string {
  if (limit === 0) {
    return `پلن «${planName}» شامل ${FEATURE[resource]} نیست؛ برای استفاده باید پلن را ارتقا دهید.`;
  }
  const amount = resource === 'media' ? `${limit} مگابایت` : String(limit);
  return `سقف ${NOUN[resource]} در پلن «${planName}» (${amount}) پر شده است؛ برای افزایش، پلن را ارتقا دهید.`;
}