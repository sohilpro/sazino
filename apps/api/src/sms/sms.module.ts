import { Global, Module } from '@nestjs/common';
import { ConsoleSmsDriver } from './drivers/console.driver';
import { MelipayamakDriver } from './drivers/melipayamak.driver';
import { SmsService } from './sms.service';

@Global()
@Module({
  providers: [ConsoleSmsDriver, MelipayamakDriver, SmsService],
  exports: [SmsService, ConsoleSmsDriver],
})
export class SmsModule {}