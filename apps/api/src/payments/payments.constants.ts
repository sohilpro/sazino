export const PAYMENT_PROVIDER = 'ZARINPAL' as const;

/** حداقل مبلغ پرداخت آنلاین (تومان)؛ حداقل زرین‌پال ۱۰٬۰۰۰ ریال است */
export const MIN_ONLINE_PAYMENT = 1_000;
export const MAX_PAYMENT_ATTEMPTS = 5;
/** با شروع پرداخت، موجودی سفارش دست‌کم تا این مدت نگه داشته می‌شود */
export const PAYMENT_HOLD_MINUTES = 35;
/** سقف عمر یک سفارش پرداخت‌نشده، هر چقدر هم تمدید شود */
export const MAX_ORDER_LIFETIME_MINUTES = 120;
/** تراکنش تأیید پرداخت یک تماس شبکه‌ای دارد (timeout درگاه ۸ ثانیه است) */
export const VERIFY_TX_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;