import { Resolver } from 'node:dns/promises';

export const DNS_LOOKUP = Symbol('DNS_LOOKUP');

/** پاسخ نامشخص است (timeout، SERVFAIL، قطعی شبکه)؛ نباید «ناموفق» حساب شود */
export class DnsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DnsUnavailableError';
  }
}

export interface DnsLookup {
  /** مقدار رکوردهای TXT (تکه‌های هر رکورد به‌هم چسبیده‌اند) */
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
  /** آدرس‌های A و AAAA */
  addresses(name: string): Promise<string[]>;
}

/** «رکوردی نیست» یعنی پاسخ خالی؛ هر خطای دیگر یعنی نامشخص */
const NO_DATA = new Set(['ENODATA', 'ENOTFOUND', 'ENOENT', 'EBADNAME']);

async function answer<T>(query: () => Promise<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && NO_DATA.has(code)) return [];
    throw new DnsUnavailableError(`DNS lookup failed (${code ?? 'unknown'})`);
  }
}

/** با resolverهای عمومی می‌پرسد تا کش DNS داخلی نتیجه را کهنه نکند */
export class NodeDnsLookup implements DnsLookup {
  private readonly resolver: Resolver;

  constructor(servers: string[]) {
    this.resolver = new Resolver({ timeout: 4000, tries: 2 });
    if (servers.length > 0) this.resolver.setServers(servers);
  }

  async txt(name: string): Promise<string[]> {
    const rows = await answer(() => this.resolver.resolveTxt(name));
    return rows.map((chunks) => chunks.join(''));
  }

  cname(name: string): Promise<string[]> {
    return answer(() => this.resolver.resolveCname(name));
  }

  async addresses(name: string): Promise<string[]> {
    const [v4, v6] = await Promise.all([
      answer(() => this.resolver.resolve4(name)),
      answer(() => this.resolver.resolve6(name)),
    ]);
    return [...v4, ...v6];
  }
}