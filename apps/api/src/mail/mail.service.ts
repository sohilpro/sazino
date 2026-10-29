import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { ConsoleMailDriver } from './drivers/console.driver';
import { SmtpMailDriver } from './drivers/smtp.driver';
import type { MailDriver, MailMessage } from './mail.types';

@Injectable()
export class MailService {
  /** null یعنی ایمیل خاموش است (MAIL_DRIVER=none) */
  private readonly driver: MailDriver | null;

  constructor(
    config: ConfigService<Env, true>,
    consoleDriver: ConsoleMailDriver,
    smtp: SmtpMailDriver,
  ) {
    const name = config.get('MAIL_DRIVER', { infer: true });
    this.driver = name === 'smtp' ? smtp : name === 'console' ? consoleDriver : null;
  }

  get enabled(): boolean {
    return this.driver !== null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.driver || message.to.length === 0) return;
    await this.driver.send(message);
  }
}