import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';
import type { MailDriver, MailMessage } from '../mail.types';

@Injectable()
export class SmtpMailDriver implements MailDriver {
  private readonly transport: Transporter | null;
  private readonly from: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SMTP_URL', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transport = url ? createTransport(url) : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport || !this.from) throw new Error('SMTP is not configured');
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}