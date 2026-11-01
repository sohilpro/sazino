import { DnsUnavailableError, type DnsLookup } from '../../src/domains/dns-lookup';

const key = (name: string) => name.toLowerCase().replace(/\.$/, '');

/** DNS قابل کنترل برای تست؛ بدون هیچ ارتباط شبکه‌ای */
export class FakeDns implements DnsLookup {
  private readonly txtRecords = new Map<string, string[]>();
  private readonly cnameRecords = new Map<string, string[]>();
  private readonly addressRecords = new Map<string, string[]>();
  private readonly broken = new Set<string>();
  /** نام‌هایی که پرسیده شده‌اند */
  readonly queries: string[] = [];

  setTxt(name: string, values: string[]) {
    this.txtRecords.set(key(name), values);
  }
  setCname(name: string, values: string[]) {
    this.cnameRecords.set(key(name), values);
  }
  setAddresses(name: string, values: string[]) {
    this.addressRecords.set(key(name), values);
  }
  /** پرسیدن این نام خطای «نامشخص» می‌دهد (timeout) */
  fail(name: string) {
    this.broken.add(key(name));
  }
  reset() {
    this.txtRecords.clear();
    this.cnameRecords.clear();
    this.addressRecords.clear();
    this.broken.clear();
    this.queries.length = 0;
  }

  private read(map: Map<string, string[]>, name: string): string[] {
    this.queries.push(key(name));
    if (this.broken.has(key(name))) throw new DnsUnavailableError('timeout');
    return [...(map.get(key(name)) ?? [])];
  }

  async txt(name: string) {
    return this.read(this.txtRecords, name);
  }
  async cname(name: string) {
    return this.read(this.cnameRecords, name);
  }
  async addresses(name: string) {
    return this.read(this.addressRecords, name);
  }
}