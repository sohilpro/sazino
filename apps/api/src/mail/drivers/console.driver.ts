import { Injectable, Logger } from '@nestjs/common';
import type { MailDriver, MailMessage } from '../mail.types';

/** توسعه و تست: ایمیل را در لاگ می‌نویسد و در حافظه نگه می‌دارد */
@Injectable()
export class ConsoleMailDriver implements MailDriver {
  private readonly logger = new Logger('Mail');
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > 200) this.outbox.shift();
    if (process.env.NODE_ENV !== 'test') {
      this.logger.log(`[console] → ${message.to.join(', ')}: ${message.subject}`);
    }
  }
}