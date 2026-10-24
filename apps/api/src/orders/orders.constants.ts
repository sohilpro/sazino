export const ORDER_PAYMENT_WINDOW_MINUTES = 30;
export const MAX_PENDING_ORDERS = 3;
export const MAX_ADDRESSES = 10;
export const FIRST_ORDER_NUMBER = 1001;
/** حداکثر مبلغ یک سفارش (تومان)؛ ستون‌ها Int هستند */
export const MAX_ORDER_TOTAL = 2_000_000_000;
export const MAX_SHIPPING_FEE = 100_000_000;

export const CANCEL_REASON = {
  CUSTOMER: 'CUSTOMER',
  EXPIRED: 'EXPIRED',
  SELLER: 'SELLER',
} as const;