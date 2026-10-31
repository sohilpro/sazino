import { z } from 'zod';

// مقدار خالی در .env یعنی «تنظیم‌نشده»
const optionalText = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const optionalInt = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    MINIO_ENDPOINT: z.string().url(),
    MINIO_BUCKET: z.string().min(3).default('myapp-media'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_REGION: z.string().min(1).default('us-east-1'),
    MEDIA_PUBLIC_URL: z.string().url().default('http://localhost:9000/myapp-media'),
    CORS_ORIGINS: z.string().default(''),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    PLATFORM_DOMAIN: z.string().min(1).default('localhost'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    SMS_DRIVER: z.enum(['console', 'melipayamak']).default('console'),
    MELI_SMS_USER: optionalText,
    MELI_SMS_PASS: optionalText,
    MELI_SMS_PATTERN_OTP: optionalInt,
    MELI_SMS_PATTERN_ORDER: optionalInt,
    ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, {
      message: 'ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    }),
    PAYMENT_DRIVER: z.enum(['fake', 'zarinpal']).default('fake'),
    ZARINPAL_SANDBOX: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    JOBS_ENABLED: z.enum(['true', 'false']).default('true'),
    QUEUE_PREFIX: z.string().min(1).default('myapp'),
    DASHBOARD_URL: z.string().url().default('http://localhost:3001'),
    MAIL_DRIVER: z.enum(['console', 'smtp', 'none']).default('console'),
    SMTP_URL: optionalText,
    MAIL_FROM: optionalText,
    MELI_SMS_PATTERN_SHIPPED: optionalInt,
    STOREFRONT_URL_TEMPLATE: z
      .string()
      .refine(
        (v) => {
          try {
            return (
              v.includes('{subdomain}') && Boolean(new URL(v.replace('{subdomain}', 'x')).host)
            );
          } catch {
            return false;
          }
        },
        { message: 'STOREFRONT_URL_TEMPLATE must be a URL that contains {subdomain}' },
      )
      .default('http://{subdomain}.localhost:3000'),
  })
  .superRefine((env, ctx) => {
    if (env.SMS_DRIVER === 'melipayamak') {
      for (const key of ['MELI_SMS_USER', 'MELI_SMS_PASS', 'MELI_SMS_PATTERN_OTP'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when SMS_DRIVER=melipayamak`,
          });
        }
      }
    }
    if (env.NODE_ENV === 'production' && env.SMS_DRIVER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_DRIVER'],
        message: 'the console SMS driver is not allowed in production',
      });
    }

    if (env.NODE_ENV === 'production' && env.PAYMENT_DRIVER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_DRIVER'],
        message: 'the fake payment driver is not allowed in production',
      });
    }

    if (env.MAIL_DRIVER === 'smtp') {
      for (const key of ['SMTP_URL', 'MAIL_FROM'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when MAIL_DRIVER=smtp`,
          });
        }
      }
    }
    if (env.NODE_ENV === 'production' && env.MAIL_DRIVER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_DRIVER'],
        message: 'the console mail driver is not allowed in production (use smtp or none)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
