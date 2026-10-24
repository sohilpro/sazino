/** نوع پیامک؛ هر نوع یک کد پترن در .env دارد */
export type SmsKind = 'otp' | 'order';

export interface PatternMessage {
  kind: SmsKind;
  /** شماره‌ی نرمال‌شده 09xxxxxxxxx */
  to: string;
  /** متغیرهای پترن به ترتیب {0}، {1}، ... */
  args: string[];
}

export interface SmsDriver {
  send(message: PatternMessage): Promise<void>;
}

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsSendError';
  }
}