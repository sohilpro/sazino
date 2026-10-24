import { afterEach, describe, expect, it, vi } from 'vitest';
import { MelipayamakDriver } from '../../src/sms/drivers/melipayamak.driver';
import { SmsSendError } from '../../src/sms/sms.types';

const settings: Record<string, unknown> = {
  MELI_SMS_USER: 'user1',
  MELI_SMS_PASS: 'super-secret-pass',
  MELI_SMS_PATTERN_OTP: 111,
  MELI_SMS_PATTERN_ORDER: 222,
};
const driver = () => new MelipayamakDriver({ get: (key: string) => settings[key] } as never);

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('MelipayamakDriver', () => {
  it('posts the pattern request to the REST endpoint', async () => {
    const fetchMock = mockFetch({ RetStatus: 1, StrRetStatus: 'Ok', Value: '123' });

    await driver().send({ kind: 'otp', to: '09121234567', args: ['123456'] });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber');
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      username: 'user1',
      password: 'super-secret-pass',
      text: '123456',
      to: '09121234567',
      bodyId: '111',
    });
  });

  it('joins several arguments with ; and strips ; inside values', async () => {
    const fetchMock = mockFetch({ StrRetStatus: 'Ok' });
    await driver().send({ kind: 'order', to: '09121234567', args: ['A;B', '42'] });

    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('text')).toBe('A B;42');
    expect(body.get('bodyId')).toBe('222');
  });

  it('throws when the provider rejects, without leaking the password', async () => {
    mockFetch({ RetStatus: 109, StrRetStatus: 'IpNotAllowed' });

    const error = await driver()
      .send({ kind: 'otp', to: '09121234567', args: ['1'] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SmsSendError);
    expect((error as Error).message).toContain('IpNotAllowed');
    expect((error as Error).message).not.toContain('super-secret-pass');
  });

  it('throws on non-JSON or HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => Promise.reject(new Error('html')),
        }),
    );
    await expect(
      driver().send({ kind: 'otp', to: '09121234567', args: ['1'] }),
    ).rejects.toBeInstanceOf(SmsSendError);
  });

  it('throws on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(
      driver().send({ kind: 'otp', to: '09121234567', args: ['1'] }),
    ).rejects.toBeInstanceOf(SmsSendError);
  });

  it('throws when the pattern is not configured', async () => {
    const noPattern = new MelipayamakDriver({ get: () => undefined } as never);
    await expect(noPattern.send({ kind: 'order', to: '09121234567', args: ['1'] })).rejects.toThrow(
      'not configured',
    );
  });
});
