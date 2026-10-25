import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type {
  GatewayRequestInput,
  GatewayRequestResult,
  GatewayVerifyInput,
  GatewayVerifyResult,
  ZarinpalApi,
} from './zarinpal.types';

interface FakeSession {
  merchantId: string;
  amount: number;
  refId: string | null;
}

const MAX_SESSIONS = 1_000;

/**
 * درگاه جعلی برای توسعه و تست. صفحه‌ی «بانک» همان /dev/fake-gateway ویترین است
 * که فقط در حالت dev وجود دارد. رفتار verify مثل زرین‌پال است
 * (شناسه و مبلغ باید یکی باشد؛ تأیید دوباره کد ۱۰۱ می‌دهد).
 */
@Injectable()
export class FakeZarinpalDriver implements ZarinpalApi {
  private readonly sessions = new Map<string, FakeSession>();

  async request(input: GatewayRequestInput): Promise<GatewayRequestResult> {
    if (this.sessions.size >= MAX_SESSIONS) {
      this.sessions.delete(this.sessions.keys().next().value as string);
    }

    const authority = `FAKE${randomUUID().replace(/-/g, '').toUpperCase()}`;
    this.sessions.set(authority, { merchantId: input.merchantId, amount: input.amount, refId: null });

    const origin = new URL(input.callbackUrl).origin;
    return {
      kind: 'ok',
      authority,
      paymentUrl: `${origin}/dev/fake-gateway?authority=${authority}&amount=${input.amount}`,
    };
  }

  async verify(input: GatewayVerifyInput): Promise<GatewayVerifyResult> {
    const session = this.sessions.get(input.authority);
    if (!session || session.merchantId !== input.merchantId) {
      return { kind: 'rejected', code: -54, message: 'invalid authority' };
    }
    if (session.amount !== input.amount) {
      return { kind: 'rejected', code: -50, message: 'amount mismatch' };
    }

    const already = session.refId !== null;
    session.refId ??= String(randomInt(100_000_000, 999_999_999));
    return { kind: 'verified', code: already ? 101 : 100, refId: session.refId, cardPan: '603799******1234' };
  }
}