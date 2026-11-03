import { DEFAULT_PLANS, isPlanKey, PLAN_KEYS } from '../../src/plans/plan-defaults';
import { planLimitMessage } from '../../src/plans/plan-limit-message';

describe('planLimitMessage', () => {
  it('explains a full quota', () => {
    expect(planLimitMessage('products', 'رایگان', 20)).toBe(
      'سقف تعداد محصولات در پلن «رایگان» (20) پر شده است؛ برای افزایش، پلن را ارتقا دهید.',
    );
    expect(planLimitMessage('media', 'پایه', 2048)).toContain('2048 مگابایت');
  });

  it('says the feature is missing when the limit is zero', () => {
    expect(planLimitMessage('domains', 'رایگان', 0)).toBe(
      'پلن «رایگان» شامل دامنه‌ی اختصاصی نیست؛ برای استفاده باید پلن را ارتقا دهید.',
    );
    expect(planLimitMessage('products', 'x', 0)).toContain('ساخت محصول');
    expect(planLimitMessage('media', 'x', 0)).toContain('آپلود تصویر');
  });
});

describe('plan defaults', () => {
  it('covers exactly the three tenant plans, with growing limits', () => {
    expect(PLAN_KEYS).toEqual(['FREE', 'BASIC', 'PRO']);
    const [free, basic, pro] = DEFAULT_PLANS;
    expect(free!.maxProducts!).toBeLessThan(basic!.maxProducts!);
    expect(pro!.maxProducts).toBeNull(); // نامحدود
    expect(free!.priceMonthly).toBe(0);
  });

  it('recognizes only valid keys', () => {
    expect(isPlanKey('PRO')).toBe(true);
    for (const v of ['pro', 'ENTERPRISE', '', null, 5]) expect(isPlanKey(v)).toBe(false);
  });
});