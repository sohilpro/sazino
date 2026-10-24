export interface ShippingRule {
  fee: number;
  freeThreshold: number | null;
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface Totals {
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShipping: boolean;
}

/** تنها جایی که مبلغ سفارش حساب می‌شود (پیش‌نمایش و ثبت سفارش هر دو از همین استفاده می‌کنند) */
export function computeTotals(lines: PricedLine[], rule: ShippingRule): Totals {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  if (subtotal === 0) return { subtotal: 0, shippingFee: 0, total: 0, freeShipping: false };

  const reachedFree = rule.freeThreshold !== null && subtotal >= rule.freeThreshold;
  const shippingFee = reachedFree ? 0 : rule.fee;

  return {
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    // رایگان‌شدن فقط وقتی معنی دارد که روش ارسال اصلاً هزینه داشته باشد
    freeShipping: reachedFree && rule.fee > 0,
  };
}