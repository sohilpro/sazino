import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from '../shared/sentry-scrub';

describe('scrubSentryEvent', () => {
  const event = {
    request: {
      url: 'https://shop.example.com/checkout?authority=A0001&token=abc',
      method: 'GET',
      headers: { Cookie: 'sf_session=secret', 'User-Agent': 'ua', Authorization: 'x' },
    },
    user: { id: 'c-1', email: 'a@b.com' },
    message: 'failed for 09123456789',
    breadcrumbs: [{ message: 'click', data: { value: '09123456789' } }],
    extra: { cart: 1 },
  };

  it('keeps only safe request fields and strips the query string', () => {
    const out = scrubSentryEvent(event);
    expect(out.request).toEqual({
      method: 'GET',
      url: 'https://shop.example.com/checkout',
      headers: { 'User-Agent': 'ua' },
    });
    expect(out.user).toEqual({ id: 'c-1' });
    expect(out.extra).toBeUndefined();
  });

  it('masks phone numbers and drops breadcrumb data', () => {
    const out = scrubSentryEvent(event);
    expect(out.message).toBe('failed for 0912***6789');
    expect(out.breadcrumbs?.[0]).toEqual({ message: 'click', data: undefined });
  });
});