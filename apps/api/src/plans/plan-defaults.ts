import type { TenantPlan } from '@myapp/shared-types';

export interface PlanDefaults {
  key: TenantPlan;
  name: string;
  maxProducts: number | null;
  maxDomains: number | null;
  maxMediaMb: number | null;
  priceMonthly: number;
  sortOrder: number;
}

/**
 * مقدار اولیه‌ی پلن‌ها (قیمت‌ها فقط نمایشی و نمونه‌اند).
 * این مقدارها هنگام بالا آمدن API فقط برای ردیف‌های ناموجود در دیتابیس نوشته می‌شوند؛
 * بعد از آن سوپر ادمین سقف‌ها را از پنل عوض می‌کند و هیچ چیز بازنویسی نمی‌شود.
 */
export const DEFAULT_PLANS: readonly PlanDefaults[] = [
  { key: 'FREE', name: 'رایگان', maxProducts: 20, maxDomains: 0, maxMediaMb: 200, priceMonthly: 0, sortOrder: 0 },
  { key: 'BASIC', name: 'پایه', maxProducts: 500, maxDomains: 1, maxMediaMb: 2_048, priceMonthly: 290_000, sortOrder: 1 },
  { key: 'PRO', name: 'حرفه‌ای', maxProducts: null, maxDomains: 5, maxMediaMb: 20_480, priceMonthly: 790_000, sortOrder: 2 },
];

export const PLAN_KEYS = DEFAULT_PLANS.map((p) => p.key) as TenantPlan[];
export const isPlanKey = (value: unknown): value is TenantPlan =>
  typeof value === 'string' && (PLAN_KEYS as string[]).includes(value);