import { normalizeCustomHostname, parseList } from '../../src/domains/hostname';

const normalize = (input: string, platform = 'myapp.com') => normalizeCustomHostname(input, platform);
const hostOf = (input: string) => {
  const r = normalize(input);
  return r.ok ? r.hostname : r.reason;
};

describe('normalizeCustomHostname', () => {
  it('lowercases and accepts normal domains', () => {
    expect(hostOf('Shop.Example.COM')).toBe('shop.example.com');
    expect(hostOf('example.ir')).toBe('example.ir');
    expect(hostOf('a-b.c-d.example.co.uk')).toBe('a-b.c-d.example.co.uk');
  });

  it('extracts the host from pasted urls and strips ports and trailing dots', () => {
    expect(hostOf('https://www.example.com/path?x=1#y')).toBe('www.example.com');
    expect(hostOf('HTTP://Shop.Example.com:8443/')).toBe('shop.example.com');
    expect(hostOf('  example.com.  ')).toBe('example.com');
  });

  it('converts internationalized names to punycode', () => {
    expect(hostOf('münchen.de')).toBe('xn--mnchen-3ya.de');
    const persian = hostOf('فروشگاه.com');
    expect(persian.startsWith('xn--')).toBe(true);
    expect(persian.endsWith('.com')).toBe(true);
  });

  it('rejects ip addresses', () => {
    for (const v of ['127.0.0.1', '192.168.1.10', '[::1]', '::1', 'example.com:80:90']) {
      expect(normalize(v)).toEqual({ ok: false, reason: 'ip' });
    }
  });

  it('rejects reserved and special-use tlds', () => {
    for (const v of ['shop.localhost', 'a.local', 'x.internal', 'shop.test', 'a.invalid', 'x.example', 'a.onion', 'router.lan']) {
      expect(normalize(v)).toEqual({ ok: false, reason: 'reserved' });
    }
    // «example» فقط به‌عنوان TLD ممنوع است، نه به‌عنوان نام
    expect(hostOf('shop.example.org')).toBe('shop.example.org');
  });

  it('rejects the platform domain and every subdomain of it', () => {
    for (const v of ['myapp.com', 'api.myapp.com', 'admin.shop.myapp.com', 'MYAPP.COM']) {
      expect(normalize(v)).toEqual({ ok: false, reason: 'platform' });
    }
    expect(hostOf('notmyapp.com')).toBe('notmyapp.com');
    expect(hostOf('myapp.com.evil.org')).toBe('myapp.com.evil.org');
  });

  it('rejects malformed names', () => {
    for (const v of [
      '',
      ' ',
      'localhost',
      'singlelabel',
      'a..b.com',
      '.example.com',
      '-a.example.com',
      'a-.example.com',
      'a_b.example.com',
      '*.example.com',
      'exa mple.com',
      'example.c',
      'example.123',
      `${'a'.repeat(64)}.example.com`,
      `${'a.'.repeat(130)}com`,
      'ex$ample.com',
    ]) {
      expect(normalize(v), JSON.stringify(v)).toEqual({ ok: false, reason: expect.stringMatching(/invalid|reserved/) });
    }
  });
});

describe('parseList', () => {
  it('splits, trims and drops empty items', () => {
    expect(parseList(' 1.1.1.1, 8.8.8.8 ,,')).toEqual(['1.1.1.1', '8.8.8.8']);
    expect(parseList('')).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
});