import { beforeEach, describe, expect, it } from 'vitest';
import { DnsUnavailableError } from '../../src/domains/dns-lookup';
import { DomainVerifier, VERIFY_LABEL, VERIFY_PREFIX } from '../../src/domains/domain-verifier';
import { FakeDns } from '../helpers/fake-dns';

const TOKEN = 'abc123def456';
const HOST = 'shop.example.org';
const TXT_NAME = `${VERIFY_LABEL}.${HOST}`;
const TARGET = 'stores.myapp.com';

function make(dns: FakeDns, extra: Record<string, unknown> = {}) {
  const config = { PLATFORM_DOMAIN: 'myapp.com', ...extra };
  return new DomainVerifier(dns, { get: (k: string) => config[k as keyof typeof config] } as never);
}

let dns: FakeDns;
beforeEach(() => {
  dns = new FakeDns();
});

describe('records', () => {
  it('defaults the cname target to stores.<platform>', () => {
    const v = make(dns);
    expect(v.records(HOST, TOKEN)).toEqual({
      txtName: TXT_NAME,
      txtValue: `${VERIFY_PREFIX}${TOKEN}`,
      cnameTarget: TARGET,
      addresses: [],
    });
  });

  it('honours an explicit target and server ips', () => {
    const v = make(dns, { DOMAIN_CNAME_TARGET: 'Edge.Example.NET.', DOMAIN_SERVER_IPS: '203.0.113.10, 2001:DB8::1' });
    expect(v.records(HOST, TOKEN)).toMatchObject({ cnameTarget: 'edge.example.net', addresses: ['203.0.113.10', '2001:db8::1'] });
  });
});

describe('ownership', () => {
  const v = () => make(dns);

  it('needs the exact verification value', async () => {
    expect(await v().checkOwnership(HOST, TOKEN)).toEqual({ ok: false, found: [] });

    dns.setTxt(TXT_NAME, [`${VERIFY_PREFIX}other`, 'v=spf1 -all']);
    const wrong = await v().checkOwnership(HOST, TOKEN);
    expect(wrong.ok).toBe(false);
    expect(wrong.found).toEqual([`${VERIFY_PREFIX}other`, 'v=spf1 -all']);

    dns.setTxt(TXT_NAME, ['v=spf1 -all', `${VERIFY_PREFIX}${TOKEN}`]);
    expect((await v().checkOwnership(HOST, TOKEN)).ok).toBe(true);
  });

  it('ignores quotes and surrounding spaces some registrars add', async () => {
    dns.setTxt(TXT_NAME, [`  "${VERIFY_PREFIX}${TOKEN}"  `]);
    expect((await v().checkOwnership(HOST, TOKEN)).ok).toBe(true);
  });

  it('does not accept a token that merely contains the expected one', async () => {
    dns.setTxt(TXT_NAME, [`${VERIFY_PREFIX}${TOKEN}x`, `x${VERIFY_PREFIX}${TOKEN}`]);
    expect((await v().checkOwnership(HOST, TOKEN)).ok).toBe(false);
  });

  it('does not accept the record placed on the bare host', async () => {
    dns.setTxt(HOST, [`${VERIFY_PREFIX}${TOKEN}`]);
    expect((await v().checkOwnership(HOST, TOKEN)).ok).toBe(false);
  });

  it('limits what it reports back', async () => {
    dns.setTxt(TXT_NAME, Array.from({ length: 10 }, (_, i) => `v${i}${'x'.repeat(500)}`));
    const result = await v().checkOwnership(HOST, TOKEN);
    expect(result.found).toHaveLength(5);
    expect(result.found[0]!.length).toBe(200);
  });
});

describe('routing', () => {
  it('accepts a cname to the target (case and trailing dot insensitive)', async () => {
    dns.setTxt(TXT_NAME, [`${VERIFY_PREFIX}${TOKEN}`]);
    dns.setCname(HOST, ['Stores.MyApp.com.']);

    const result = await make(dns).check(HOST, TOKEN);
    expect(result.txt.ok).toBe(true);
    expect(result.routing).toMatchObject({ ok: true, via: 'cname' });
  });

  it('rejects a cname to somewhere else', async () => {
    dns.setCname(HOST, ['somewhere.else.net']);
    const result = await make(dns).check(HOST, TOKEN);
    expect(result.routing).toMatchObject({ ok: false, via: null, cname: ['somewhere.else.net'] });
  });

  it('accepts addresses that overlap the target (apex alias or flattened cname)', async () => {
    dns.setAddresses(TARGET, ['198.51.100.7', '198.51.100.8']);
    dns.setAddresses(HOST, ['198.51.100.8']);

    expect((await make(dns).check(HOST, TOKEN)).routing).toMatchObject({ ok: true, via: 'address' });
  });

  it('accepts the configured server ips', async () => {
    dns.setAddresses(HOST, ['203.0.113.10']);
    const result = await make(dns, { DOMAIN_SERVER_IPS: '203.0.113.10' }).check(HOST, TOKEN);
    expect(result.routing).toMatchObject({ ok: true, via: 'address' });
  });

  it('rejects unrelated addresses and an empty answer', async () => {
    dns.setAddresses(TARGET, ['198.51.100.7']);
    dns.setAddresses(HOST, ['192.0.2.1']);
    expect((await make(dns).check(HOST, TOKEN)).routing.ok).toBe(false);

    dns.reset();
    expect((await make(dns).check(HOST, TOKEN)).routing.ok).toBe(false);
  });

  it('does not treat an empty target as a match for an empty host answer', async () => {
    const result = await make(dns).check(HOST, TOKEN);
    expect(result.routing).toMatchObject({ ok: false, addresses: [] });
  });
});

describe('dns failures', () => {
  it('lets undetermined answers surface instead of reporting failure', async () => {
    dns.fail(TXT_NAME);
    await expect(make(dns).check(HOST, TOKEN)).rejects.toBeInstanceOf(DnsUnavailableError);
    await expect(make(dns).checkOwnership(HOST, TOKEN)).rejects.toBeInstanceOf(DnsUnavailableError);

    dns.reset();
    dns.fail(HOST);
    await expect(make(dns).check(HOST, TOKEN)).rejects.toBeInstanceOf(DnsUnavailableError);
  });
});