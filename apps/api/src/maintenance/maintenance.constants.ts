export const MAINTENANCE_QUEUE = 'maintenance';

export const MAINTENANCE_JOB = {
  EXPIRE_ORDERS: 'expire-orders',
  RECONCILE_PAYMENTS: 'reconcile-payments',
  CLEANUP: 'cleanup',
  REVALIDATE_DOMAINS: 'revalidate-domains',
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
/** پرداخت‌های جدیدتر از این مدت هنوز شاید مشتری در صفحه‌ی بانک است */
export const RECONCILE_MIN_AGE_MS = 5 * 60_000;
/** پرداخت‌های قدیمی‌تر از این مدت دیگر معتبر نیستند (authority منقضی شده) */
export const RECONCILE_MAX_AGE_MS = 60 * 60_000;
export const GUEST_CART_TTL_MS = 30 * DAY_MS;
