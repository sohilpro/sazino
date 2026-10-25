export interface GatewayRequestInput {
  merchantId: string;
  /** تومان */
  amount: number;
  callbackUrl: string;
  description: string;
  mobile?: string;
}

export type GatewayRequestResult =
  | { kind: 'ok'; authority: string; paymentUrl: string }
  /** درگاه صراحتاً درخواست را نپذیرفت */
  | { kind: 'rejected'; code: number; message: string };

export interface GatewayVerifyInput {
  merchantId: string;
  authority: string;
  amount: number;
}

export type GatewayVerifyResult =
  | { kind: 'verified'; code: number; refId: string | null; cardPan: string | null }
  /** درگاه صراحتاً پرداخت را تأیید نکرد */
  | { kind: 'rejected'; code: number; message: string };

/** نتیجه نامشخص است (timeout، قطعی شبکه، پاسخ نامفهوم)؛ نباید «ناموفق» حساب شود */
export class GatewayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayUnavailableError';
  }
}

export interface ZarinpalApi {
  request(input: GatewayRequestInput): Promise<GatewayRequestResult>;
  verify(input: GatewayVerifyInput): Promise<GatewayVerifyResult>;
}

export const ZARINPAL_API = Symbol('ZARINPAL_API');
