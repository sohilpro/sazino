import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainCheckDto, DomainDnsRecords } from '@myapp/shared-types';
import type { Env } from '../config/env';
import { DNS_LOOKUP, type DnsLookup } from './dns-lookup';
import { parseList } from './hostname';

export const VERIFY_LABEL = '_myapp-verify';
export const VERIFY_PREFIX = 'myapp-verify=';

const clean = (v: string) => v.trim().replace(/^"|"$/g, '');
const normalize = (host: string) => host.trim().toLowerCase().replace(/\.$/, '');

@Injectable()
export class DomainVerifier {
  readonly cnameTarget: string;
  readonly serverIps: string[];

  constructor(
    @Inject(DNS_LOOKUP) private readonly dns: DnsLookup,
    config: ConfigService<Env, true>,
  ) {
    const platform = config.get('PLATFORM_DOMAIN', { infer: true }).toLowerCase();
    this.cnameTarget = normalize(config.get('DOMAIN_CNAME_TARGET', { infer: true }) ?? `stores.${platform}`);
    this.serverIps = parseList(config.get('DOMAIN_SERVER_IPS', { infer: true })).map((ip) => ip.toLowerCase());
  }

  /** رکوردهایی که فروشنده باید در DNS بگذارد */
  records(hostname: string, token: string): DomainDnsRecords {
    return {
      txtName: `${VERIFY_LABEL}.${hostname}`,
      txtValue: `${VERIFY_PREFIX}${token}`,
      cnameTarget: this.cnameTarget,
      addresses: this.serverIps,
    };
  }

  /** فقط اثبات مالکیت (رکورد TXT)؛ برای بررسی دوره‌ای هم استفاده می‌شود */
  async checkOwnership(hostname: string, token: string): Promise<DomainCheckDto['txt']> {
    const found = (await this.dns.txt(`${VERIFY_LABEL}.${hostname}`)).map(clean);
    return {
      ok: found.includes(`${VERIFY_PREFIX}${token}`),
      found: found.slice(0, 5).map((v) => v.slice(0, 200)),
    };
  }

  /**
   * مالکیت (TXT) + مسیر (CNAME یا آدرس‌های هم‌پوشان با هدف).
   * خطای DNS به‌صورت DnsUnavailableError بالا می‌آید.
   */
  async check(hostname: string, token: string): Promise<DomainCheckDto> {
    const [txt, cname, addresses, targetAddresses] = await Promise.all([
      this.checkOwnership(hostname, token),
      this.dns.cname(hostname),
      this.dns.addresses(hostname),
      this.dns.addresses(this.cnameTarget),
    ]);

    const cnames = cname.map(normalize);
    const allowed = new Set([...this.serverIps, ...targetAddresses.map((a) => a.toLowerCase())]);

    const cnameMatch = cnames.includes(this.cnameTarget);
    const addressMatch = addresses.some((a) => allowed.has(a.toLowerCase()));

    return {
      txt,
      routing: {
        ok: cnameMatch || addressMatch,
        via: cnameMatch ? 'cname' : addressMatch ? 'address' : null,
        cname: cnames.slice(0, 5),
        addresses: addresses.slice(0, 5),
      },
    };
  }
}