import { describe, expect, it } from 'vitest';
import { maskPhones, REDACTED, redactValue } from '../../src/common/logging/redact';

describe('maskPhones', () => {
  it('masks Iranian mobile numbers inside text', () => {
    expect(maskPhones('کد برای 09123456789 ارسال شد')).toBe('کد برای 0912***6789 ارسال شد');
  });

  it('leaves other digit runs alone', () => {
    expect(maskPhones('order 1001 total 450000 ref 0912345678901')).toBe(
      'order 1001 total 450000 ref 0912345678901',
    );
  });
});

describe('redactValue', () => {
  it('redacts sensitive keys at any depth', () => {
    const out = redactValue({
      password: 'x',
      nested: { accessToken: 'abc', Authorization: 'Bearer z', merchantId: 'm', ok: 1 },
      list: [{ otp: '123456', code: 'PRICE_CHANGED' }],
    });
    expect(out).toEqual({
      password: REDACTED,
      nested: { accessToken: REDACTED, Authorization: REDACTED, merchantId: REDACTED, ok: 1 },
      list: [{ otp: REDACTED, code: 'PRICE_CHANGED' }],
    });
  });

  it('masks phones in values and keeps plain data', () => {
    expect(redactValue({ msg: 'to 09123456789', n: 3, ok: true, nothing: null })).toEqual({
      msg: 'to 0912***6789',
      n: 3,
      ok: true,
      nothing: null,
    });
  });

  it('serializes dates and errors without leaking internals', () => {
    const out = redactValue({ at: new Date('2026-11-05T10:00:00.000Z'), err: new Error('boom 09123456789') });
    expect(out).toEqual({
      at: '2026-11-05T10:00:00.000Z',
      err: { name: 'Error', message: 'boom 0912***6789' },
    });
  });

  it('stops at a maximum depth instead of looping', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => redactValue(a)).not.toThrow();
  });
});