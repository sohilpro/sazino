import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { SmsSendError, type PatternMessage, type SmsDriver } from '../sms.types';

const ENDPOINT = 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber';
const TIMEOUT_MS = 8000;

interface MeliResponse {
  RetStatus?: number;
  StrRetStatus?: string;
  Value?: string;
}

@Injectable()
export class MelipayamakDriver implements SmsDriver {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: PatternMessage): Promise<void> {
    const bodyId =
      message.kind === 'otp'
        ? this.config.get('MELI_SMS_PATTERN_OTP', { infer: true })
        : this.config.get('MELI_SMS_PATTERN_ORDER', { infer: true });
    if (!bodyId) throw new SmsSendError(`SMS pattern for "${message.kind}" is not configured`);

    const body = new URLSearchParams({
      username: this.config.get('MELI_SMS_USER', { infer: true }) ?? '',
      password: this.config.get('MELI_SMS_PASS', { infer: true }) ?? '',
      // متغیرها با ; جدا می‌شوند؛ پس خود ; نباید داخل مقدار باشد
      text: message.args.map((a) => a.replace(/;/g, ' ')).join(';'),
      to: message.to,
      bodyId: String(bodyId),
    });

    let res: Response;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      // رمز هرگز در پیام خطا نمی‌آید
      throw new SmsSendError(`Melipayamak request failed: ${(err as Error).name}`);
    }

    const data = (await res.json().catch(() => null)) as MeliResponse | null;
    if (!res.ok || data?.StrRetStatus !== 'Ok') {
      throw new SmsSendError(
        `Melipayamak rejected the message: status=${data?.StrRetStatus ?? res.status} code=${data?.RetStatus ?? '-'}`,
      );
    }
  }
}