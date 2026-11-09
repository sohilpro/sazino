import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from '../../src/common/sentry-scrub';

describe('scrubSentryEvent', () => {
  const event = {
    request: {
      url: 'https://api.example.com/api/auth/login?token=abc',
      method: 'POST',
      headers: { Cookie: 'sf_session=secret', Authorization: 'Bearer x', 'User-Agent': 'jest', 'X-Request-Id': 'r-1' },
      data: { password: 'p' },
    },
    user: { id: 'u-1', email: 'a@b.com', ip_address: '1.2.3.4' },
    message: 'otp failed for 09123456789',
    exception: { values: [{ value: 'cannot send to 09123456789' }] },
    breadcrumbs: [{ message: 'tap 09123456789', data: { secret: 1 } }],
    extra: { token: 'abc' },
  };

  it('drops cookies, auth headers, query, body, email and ip', () => {
    const out = scrubSentryEvent(event);
    expect(out.request).toEqual({
      method: 'POST',
      url: 'https://api.example.com/api/auth/login',
      headers: { 'User-Agent': 'jest', 'X-Request-Id': 'r-1' },
    });
    expect(out.user).toEqual({ id: 'u-1' });
    expect(out.extra).toBeUndefined();
  });

  it('masks phone numbers everywhere text can appear', () => {
    const out = scrubSentryEvent(event);
    expect(out.message).toBe('otp failed for 0912***6789');
    expect(out.exception?.values?.[0]?.value).toBe('cannot send to 0912***6789');
    expect(out.breadcrumbs?.[0]).toEqual({ message: 'tap 0912***6789', data: undefined });
  });

  it('does not mutate the original event and tolerates empty events', () => {
    scrubSentryEvent(event);
    expect(event.request.headers.Cookie).toBe('sf_session=secret');
    expect(scrubSentryEvent({})).toEqual({ user: undefined, extra: undefined });
  });
});