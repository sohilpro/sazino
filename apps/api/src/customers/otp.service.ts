import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { OtpRequestResponse } from '@myapp/shared-types';
import { maskPhone } from '../common/phone';
import type { Env } from '../config/env';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SmsService } from '../sms/sms.service';
import { TenantContext } from '../tenants/tenant-context';
import { OTP } from './customers.constants';

const tooMany = (message: string, retryAfter: number) =>
  new HttpException({ statusCode: 429, error: 'Too Many Requests', message, retryAfter }, 429);

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly secret: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ctx: TenantContext,
    private readonly sms: SmsService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  /** کلیدهای Redis؛ همه شامل tenantId (یک شماره در دو فروشگاه کاملاً مستقل است) */
  keys(tenantId: string, phone: string, ip = 'unknown') {
    const day = new Date().toISOString().slice(0, 10);
    return {
      code: `otp:code:${tenantId}:${phone}`,
      cooldown: `otp:cd:${tenantId}:${phone}`,
      phoneHourly: `otp:ph:${tenantId}:${phone}`,
      ipHourly: `otp:ip:${tenantId}:${ip}`,
      tenantDaily: `otp:day:${tenantId}:${day}`,
    };
  }

  async request(phone: string, ip: string | undefined): Promise<OtpRequestResponse> {
    const tenantId = this.ctx.require();
    const k = this.keys(tenantId, phone, ip);

    // ۱) فاصله‌ی حداقلی بین دو درخواست
    const claimed = await this.redis.set(k.cooldown, '1', 'EX', OTP.RESEND, 'NX');
    if (claimed === null) {
      const wait = Math.max(await this.redis.ttl(k.cooldown), 1);
      throw tooMany(`کد قبلاً ارسال شده است؛ ${wait} ثانیه‌ی دیگر دوباره تلاش کنید`, wait);
    }

    // ۲) سقف‌ها
    const limits: Array<[string, number, number, string]> = [
      [k.phoneHourly, OTP.PHONE_HOURLY, 3600, 'تعداد درخواست برای این شماره زیاد است؛ بعداً دوباره تلاش کنید'],
      [k.ipHourly, OTP.IP_HOURLY, 3600, 'تعداد درخواست‌ها زیاد است؛ بعداً دوباره تلاش کنید'],
      [k.tenantDaily, OTP.TENANT_DAILY, 90_000, 'سقف ارسال پیامک این فروشگاه برای امروز پر شده است'],
    ];
    for (const [key, limit, ttl, message] of limits) {
      const retryAfter = await this.hit(key, limit, ttl);
      if (retryAfter > 0) throw tooMany(message, retryAfter);
    }

    // ۳) ساخت و ذخیره‌ی کد (فقط هش)
    const code = String(randomInt(0, 10 ** OTP.LENGTH)).padStart(OTP.LENGTH, '0');
    await this.redis
      .multi()
      .hset(k.code, { h: this.hash(tenantId, phone, code), a: '0' })
      .expire(k.code, OTP.TTL)
      .exec();

    // ۴) ارسال
    try {
      await this.sms.sendOtp(phone, code);
    } catch (err) {
      this.logger.error(`OTP SMS to ${maskPhone(phone)} failed: ${(err as Error).message}`);
      await this.redis.del(k.code, k.cooldown);
      throw new BadGatewayException('ارسال پیامک ناموفق بود؛ کمی بعد دوباره تلاش کنید');
    }

    return { expiresIn: OTP.TTL, resendIn: OTP.RESEND };
  }

  /** true فقط یک‌بار برای هر کد درست؛ کد پس از موفقیت یا ۵ تلاش اشتباه از بین می‌رود */
  async verify(phone: string, code: string): Promise<boolean> {
    const tenantId = this.ctx.require();
    const key = this.keys(tenantId, phone).code;

    const data = await this.redis.hgetall(key);
    if (!data.h) return false;

    if (Number(data.a ?? 0) >= OTP.MAX_ATTEMPTS) {
      await this.redis.del(key);
      return false;
    }

    const expected = Buffer.from(data.h, 'hex');
    const given = Buffer.from(this.hash(tenantId, phone, code), 'hex');
    const equal = expected.length === given.length && timingSafeEqual(expected, given);

    if (!equal) {
      const attempts = await this.redis.hincrby(key, 'a', 1);
      if (attempts >= OTP.MAX_ATTEMPTS) await this.redis.del(key);
      return false;
    }

    // مصرف اتمیک: اگر دو درخواست هم‌زمان بیایند فقط یکی DEL را می‌برد
    return (await this.redis.del(key)) === 1;
  }

  /** شمارنده با TTL تضمینی؛ 0 = مجاز، در غیر این صورت ثانیه‌های باقی‌مانده */
  private async hit(key: string, limit: number, ttl: number): Promise<number> {
    await this.redis.set(key, '0', 'EX', ttl, 'NX');
    const count = await this.redis.incr(key);
    if (count <= limit) return 0;
    return Math.max(await this.redis.ttl(key), 1);
  }

  private hash(tenantId: string, phone: string, code: string): string {
    return createHmac('sha256', this.secret).update(`otp:${tenantId}:${phone}:${code}`).digest('hex');
  }
}