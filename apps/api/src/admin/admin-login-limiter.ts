import { HttpException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ADMIN_LOGIN } from './admin.constants';

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);

/** محدودیت تلاش ناموفق ورود ادمین به ازای ایمیل و IP (شمارنده‌ی Redis با TTL تضمینی) */
@Injectable()
export class AdminLoginLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private keys(email: string, ip: string) {
    return {
      email: `admin:login:email:${hash(email.toLowerCase())}`,
      ip: `admin:login:ip:${hash(ip || 'unknown')}`,
    };
  }

  async assertAllowed(email: string, ip: string): Promise<void> {
    const k = this.keys(email, ip);
    const [byEmail, byIp] = await this.redis.mget(k.email, k.ip);

    if (Number(byEmail ?? 0) >= ADMIN_LOGIN.EMAIL_FAILURES || Number(byIp ?? 0) >= ADMIN_LOGIN.IP_FAILURES) {
      const retryAfter = Math.max(await this.redis.ttl(Number(byEmail ?? 0) >= ADMIN_LOGIN.EMAIL_FAILURES ? k.email : k.ip), 1);
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'تلاش‌های ناموفق زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید',
          retryAfter,
        },
        429,
      );
    }
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    for (const key of Object.values(this.keys(email, ip))) {
      await this.redis.set(key, '0', 'EX', ADMIN_LOGIN.WINDOW_SECONDS, 'NX');
      await this.redis.incr(key);
    }
  }

  /** بعد از ورود موفق شمارنده‌ی ایمیل صفر می‌شود (شمارنده‌ی IP نه) */
  async reset(email: string, ip: string): Promise<void> {
    await this.redis.del(this.keys(email, ip).email);
  }
}