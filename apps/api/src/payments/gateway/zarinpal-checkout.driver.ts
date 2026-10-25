import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWithOptions } from 'zarinpal-checkout';
import type { Env } from '../../config/env';
import {
  GatewayUnavailableError,
  type GatewayRequestInput,
  type GatewayRequestResult,
  type GatewayVerifyInput,
  type GatewayVerifyResult,
  type ZarinpalApi,
} from './zarinpal.types';

const TIMEOUT_MS = 8_000;

/** شکل پاسخ پکیج؛ عمداً سخت‌گیرانه تفسیر می‌شود (هر چیز نامفهوم = نامشخص) */
interface LooseResult {
  status?: unknown;
  authority?: unknown;
  url?: unknown;
  RefID?: unknown;
  refId?: unknown;
  ref_id?: unknown;
  cardPan?: unknown;
  card_pan?: unknown;
}

const text = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return null;
};

@Injectable()
export class ZarinpalCheckoutDriver implements ZarinpalApi {
  private readonly sandbox: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.sandbox = config.get('ZARINPAL_SANDBOX', { infer: true });
  }

  /** شناسه‌ی پذیرنده هر فروشگاه متفاوت است؛ برای هر درخواست یک کلاینت ساخته می‌شود */
  private client(merchantId: string) {
    return createWithOptions(merchantId, {
      sandbox: this.sandbox,
      currency: 'IRT', // قیمت‌ها تومان‌اند؛ پیش‌فرض خود زرین‌پال ریال است
      timeoutMs: TIMEOUT_MS,
    });
  }

  async request(input: GatewayRequestInput): Promise<GatewayRequestResult> {
    let res: LooseResult | null;
    try {
      res = (await this.client(input.merchantId).PaymentRequest({
        Amount: input.amount,
        CallbackURL: input.callbackUrl,
        Description: input.description,
        ...(input.mobile ? { Mobile: input.mobile } : {}),
      })) as unknown as LooseResult | null;
    } catch (err) {
      // پیام خطا ممکن است شامل شناسه‌ی پذیرنده باشد؛ فقط نوع خطا ثبت می‌شود
      throw new GatewayUnavailableError(`ZarinPal request failed (${(err as Error).name})`);
    }

    if (!res || typeof res.status !== 'number') {
      throw new GatewayUnavailableError('ZarinPal request returned an unexpected response');
    }

    const authority = text(res.authority);
    const url = text(res.url);
    if (res.status === 100 && authority && url) {
      return { kind: 'ok', authority, paymentUrl: url };
    }
    return { kind: 'rejected', code: res.status, message: `ZarinPal request rejected (${res.status})` };
  }

  async verify(input: GatewayVerifyInput): Promise<GatewayVerifyResult> {
    let res: LooseResult | null;
    try {
      res = (await this.client(input.merchantId).PaymentVerification({
        Amount: input.amount,
        Authority: input.authority,
      })) as unknown as LooseResult | null;
    } catch (err) {
      throw new GatewayUnavailableError(`ZarinPal verify failed (${(err as Error).name})`);
    }

    if (!res || typeof res.status !== 'number') {
      throw new GatewayUnavailableError('ZarinPal verify returned an unexpected response');
    }

    // ۱۰۰ = تأیید شد، ۱۰۱ = قبلاً تأیید شده بود
    if (res.status === 100 || res.status === 101) {
      return {
        kind: 'verified',
        code: res.status,
        refId: text(res.RefID) ?? text(res.refId) ?? text(res.ref_id),
        cardPan: text(res.cardPan) ?? text(res.card_pan),
      };
    }
    return { kind: 'rejected', code: res.status, message: `ZarinPal verify rejected (${res.status})` };
  }
}