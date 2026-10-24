import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { ConsoleSmsDriver } from './drivers/console.driver';
import { MelipayamakDriver } from './drivers/melipayamak.driver';
import type { SmsDriver, SmsKind } from './sms.types';

@Injectable()
export class SmsService {
  private readonly driver: SmsDriver;

  constructor(
    config: ConfigService<Env, true>,
    consoleDriver: ConsoleSmsDriver,
    melipayamak: MelipayamakDriver,
  ) {
    this.driver =
      config.get('SMS_DRIVER', { infer: true }) === 'melipayamak' ? melipayamak : consoleDriver;
  }

  /** ارسال عمومی بر اساس نوع پترن */
  send(kind: SmsKind, to: string, args: string[]): Promise<void> {
    return this.driver.send({ kind, to, args });
  }

  sendOtp(to: string, code: string): Promise<void> {
    return this.send('otp', to, [code]);
  }

  /** پیامک ثبت سفارش (در روز ۱۳ استفاده می‌شود) */
  sendOrder(to: string, orderCode: string): Promise<void> {
    return this.send('order', to, [orderCode]);
  }
}