import { describe, expect, it, vi } from 'vitest';
import { corsOriginCallback, parseCorsOrigins } from '../../src/common/cors';

const dev = { production: false };
const prod = { production: true };

describe('parseCorsOrigins', () => {
  it('accepts bare origins and removes duplicates', () => {
    expect(parseCorsOrigins('http://localhost:3001, https://a.com,https://a.com', dev)).toEqual([
      'http://localhost:3001',
      'https://a.com',
    ]);
  });

  it('allows an empty list in development but not in production', () => {
    expect(parseCorsOrigins('', dev)).toEqual([]);
    expect(parseCorsOrigins(undefined, dev)).toEqual([]);
    expect(() => parseCorsOrigins('', prod)).toThrow();
    expect(() => parseCorsOrigins(' , ', prod)).toThrow();
  });

  it.each([
    '*',
    'https://*.example.com',
    'https://a.com/',
    'https://a.com/path',
    'https://a.com?x=1',
    'https://user:pw@a.com',
    'https://a.com:443',
    'ftp://a.com',
    'not a url',
    'a.com',
  ])('rejects %s', (origin) => {
    expect(() => parseCorsOrigins(origin, dev)).toThrow();
  });

  it('rejects http in production', () => {
    expect(() => parseCorsOrigins('http://a.com', prod)).toThrow(/https/);
    expect(parseCorsOrigins('https://a.com', prod)).toEqual(['https://a.com']);
  });
});

describe('corsOriginCallback', () => {
  const check = (origin: string | undefined) => {
    const cb = vi.fn();
    corsOriginCallback(['https://a.com'])(origin, cb);
    return cb.mock.calls[0];
  };

  it('allows listed origins and requests without Origin', () => {
    expect(check('https://a.com')).toEqual([null, true]);
    expect(check(undefined)).toEqual([null, true]);
  });

  it('denies unknown origins without raising an error', () => {
    expect(check('https://evil.com')).toEqual([null, false]);
    expect(check('https://a.com.evil.com')).toEqual([null, false]);
  });
});