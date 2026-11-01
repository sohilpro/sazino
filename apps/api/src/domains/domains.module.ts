import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { DNS_LOOKUP, NodeDnsLookup } from './dns-lookup';
import { DomainVerifier } from './domain-verifier';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { parseList } from './hostname';
import { InternalDomainsController } from './internal-domains.controller';
import { InternalDomainsService } from './internal-domains.service';

@Module({
  controllers: [DomainsController, InternalDomainsController],
  providers: [
    {
      provide: DNS_LOOKUP,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new NodeDnsLookup(parseList(config.get('DNS_RESOLVERS', { infer: true }))),
    },
    DomainVerifier,
    DomainsService,
    InternalDomainsService,
  ],
  exports: [DomainsService],
})
export class DomainsModule {}