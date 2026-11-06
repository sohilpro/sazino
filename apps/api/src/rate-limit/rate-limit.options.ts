export const RATE_LIMIT_OPTIONS = Symbol('RATE_LIMIT_OPTIONS');

export interface RateLimitOptions {
  enabled: boolean;
  ipPerMin: number;
  tenantPerMin: number;
}