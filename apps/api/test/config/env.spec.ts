import { describe, expect, it } from 'vitest';
import { validateEnv } from '../../src/config/env';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

const token = 't'.repeat(32);
const prod = {
  ...valid,
  NODE_ENV: 'production',
  SMS_DRIVER: 'melipayamak',
  MELI_SMS_USER: 'u',
  MELI_SMS_PASS: 'p',
  MELI_SMS_PATTERN_OTP: '1',
  PAYMENT_DRIVER: 'zarinpal',
  MAIL_DRIVER: 'none',
  CORS_ORIGINS: 'https://panel.example.com',
  INTERNAL_API_TOKEN: token,
  REQUIRE_PROXY_TOKEN: 'true',
  RATE_LIMIT_ENABLED: 'true',
  TENANT_DATABASE_URL: 'postgresql://myapp_rls:pw@localhost:5432/db',
};

describe('day 18 environment rules', () => {
  it('has safe defaults in development', () => {
    const env = validateEnv(valid);
    expect(env.CACHE_ENABLED).toBe(false);
    expect(env.CACHE_TTL_SECONDS).toBe(60);
    expect(env.RATE_LIMIT_ENABLED).toBe(false);
    expect(env.RATE_LIMIT_IP_PER_MIN).toBe(300);
    expect(env.RATE_LIMIT_TENANT_PER_MIN).toBe(6000);
    expect(env.REQUIRE_PROXY_TOKEN).toBe(false);
  });

  it('accepts a complete production environment', () => {
    expect(() => validateEnv(prod)).not.toThrow();
  });

  it('treats empty values as unset and rejects garbage', () => {
    expect(
      validateEnv({ ...valid, CACHE_ENABLED: '', CACHE_TTL_SECONDS: '' }).CACHE_TTL_SECONDS,
    ).toBe(60);
    expect(() => validateEnv({ ...valid, CACHE_ENABLED: 'yes' })).toThrow();
    expect(() => validateEnv({ ...valid, RATE_LIMIT_IP_PER_MIN: '0' })).toThrow();
    expect(() => validateEnv({ ...valid, CACHE_TTL_SECONDS: 'abc' })).toThrow();
  });

  it('requires the proxy token and rate limiting in production', () => {
    expect(() => validateEnv({ ...prod, REQUIRE_PROXY_TOKEN: 'false' })).toThrow(
      /REQUIRE_PROXY_TOKEN/,
    );
    expect(() => validateEnv({ ...prod, RATE_LIMIT_ENABLED: 'false' })).toThrow(
      /RATE_LIMIT_ENABLED/,
    );
  });

  it('needs INTERNAL_API_TOKEN whenever the proxy token is required', () => {
    expect(() => validateEnv({ ...valid, REQUIRE_PROXY_TOKEN: 'true' })).toThrow(
      /INTERNAL_API_TOKEN/,
    );
    expect(() =>
      validateEnv({ ...valid, REQUIRE_PROXY_TOKEN: 'true', INTERNAL_API_TOKEN: token }),
    ).not.toThrow();
  });

  it('validates CORS origins', () => {
    expect(() =>
      validateEnv({ ...valid, CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001' }),
    ).not.toThrow();
    expect(() => validateEnv({ ...valid, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => validateEnv({ ...prod, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
    expect(() => validateEnv({ ...prod, CORS_ORIGINS: 'http://a.com' })).toThrow(/CORS_ORIGINS/);
  });
});

describe('row level security environment rules', () => {
  it('is optional outside production', () => {
    expect(validateEnv(valid).TENANT_DATABASE_URL).toBeUndefined();
    expect(
      validateEnv({ ...valid, TENANT_DATABASE_URL: 'postgresql://myapp_rls:pw@localhost:5432/db' })
        .TENANT_DATABASE_URL,
    ).toContain('myapp_rls');
  });

  it('is required in production', () => {
    const { TENANT_DATABASE_URL: _omit, ...withoutTenantUrl } = prod;
    expect(() => validateEnv(withoutTenantUrl)).toThrow(/TENANT_DATABASE_URL/);
  });

  it('must use a different role than the system connection', () => {
    expect(() => validateEnv({ ...valid, TENANT_DATABASE_URL: valid.DATABASE_URL })).toThrow(
      /different role/,
    );
    expect(() => validateEnv({ ...prod, TENANT_DATABASE_URL: prod.DATABASE_URL })).toThrow(
      /different role/,
    );
  });

  it('must be a postgres URL', () => {
    expect(() => validateEnv({ ...valid, TENANT_DATABASE_URL: 'mysql://x' })).toThrow(
      /TENANT_DATABASE_URL/,
    );
  });
});
