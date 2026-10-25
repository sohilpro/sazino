export const SESSION_COOKIE = 'sf_session';
export const CART_COOKIE = 'sf_cart';
export const SESSION_TTL_DAYS = 30;
export const CART_COOKIE_DAYS = 30;

export const OTP = {
  LENGTH: 6,
  /** عمر کد (ثانیه) */
  TTL: 120,
  /** حداقل فاصله‌ی دو درخواست برای یک شماره (ثانیه) */
  RESEND: 60,
  MAX_ATTEMPTS: 5,
  PHONE_HOURLY: 5,
  IP_HOURLY: 100,
  TENANT_DAILY: 1000,
} as const;

export const MAX_LINE_QUANTITY = 20;