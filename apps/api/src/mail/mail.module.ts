import { Global, Module } from '@nestjs/common';
import { ConsoleMailDriver } from './drivers/console.driver';
import { SmtpMailDriver } from './drivers/smtp.driver';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [ConsoleMailDriver, SmtpMailDriver, MailService],
  exports: [MailService, ConsoleMailDriver],
})
export class MailModule {}