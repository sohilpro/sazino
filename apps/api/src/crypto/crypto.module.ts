import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { SecretBox } from './secret-box';

@Global()
@Module({
  providers: [
    {
      provide: SecretBox,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretBox(config.get('ENCRYPTION_KEY', { infer: true })),
    },
  ],
  exports: [SecretBox],
})
export class CryptoModule {}