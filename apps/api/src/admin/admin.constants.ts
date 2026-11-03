export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_COOKIE_PATH = '/api/admin';
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const ADMIN_LOGIN = {
  EMAIL_FAILURES: 5,
  IP_FAILURES: 20,
  WINDOW_SECONDS: 15 * 60,
} as const;

export const MIN_ADMIN_PASSWORD_LENGTH = 12;