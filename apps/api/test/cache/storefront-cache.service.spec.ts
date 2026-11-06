import { describe, expect, it, vi } from 'vitest';
import { StorefrontCacheService } from '../../src/cache/storefront-cache.service';

const on = { enabled: true, ttlSeconds: 60 };

describe('StorefrontCacheService when Redis is down', () => {
  const fail = vi.fn().mockRejectedValue(new Error('redis down'));
  const service = new StorefrontCacheService({ get: fail, set: fail, incr: fail } as never, on);

  it('never throws; reads become misses', async () => {
    await expect(service.currentVersion('t')).resolves.toBeNull();
    await expect(service.read('k')).resolves.toBeNull();
    await expect(service.write('k', '{}')).resolves.toBeUndefined();
    await expect(service.invalidate('t')).resolves.toBeUndefined();
  });
});

describe('StorefrontCacheService', () => {
  it('skips oversized bodies', async () => {
    const set = vi.fn();
    await new StorefrontCacheService({ set } as never, on).write('k', 'x'.repeat(600 * 1024));
    expect(set).not.toHaveBeenCalled();
  });

  it('does not touch Redis on invalidate when the cache is disabled', async () => {
    const incr = vi.fn();
    const service = new StorefrontCacheService({ incr } as never, { ...on, enabled: false });
    await service.invalidate('t');
    expect(incr).not.toHaveBeenCalled();
  });
});