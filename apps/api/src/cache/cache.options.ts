export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');

export interface CacheOptions {
  enabled: boolean;
  ttlSeconds: number;
}