import { Injectable, Logger } from '@nestjs/common';
import type { PatternMessage, SmsDriver } from '../sms.types';

/** توسعه و تست: پیامک را در لاگ می‌نویسد و در حافظه نگه می‌دارد */
@Injectable()
export class ConsoleSmsDriver implements SmsDriver {
  private readonly logger = new Logger('SMS');
  readonly outbox: PatternMessage[] = [];

  async send(message: PatternMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > 200) this.outbox.shift();
    if (process.env.NODE_ENV !== 'test') {
      this.logger.log(`[console] ${message.kind} → ${message.to}: ${message.args.join(' | ')}`);
    }
  }
}