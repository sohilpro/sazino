/** نوع پیامک؛ هر نوع یک کد پترن در .env دارد */
export type SmsKind = 'otp' | 'order' | 'shipped';

export interface PatternMessage {
  kind: SmsKind;
  /** شماره‌ی نرمال‌شده 09xxxxxxxxx */
  to: string;
  /** متغیرهای پترن به ترتیب {0}، {1}، ... */
  args: string[];
}

export interface SmsDriver {
  send(message: PatternMessage): Promise<void>;
  /** آیا برای این نوع پیامک امکان ارسال هست (مثلاً پترن تنظیم شده)؟ */
  supports(kind: SmsKind): boolean;
}

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsSendError';
  }
}