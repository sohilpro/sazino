import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthService } from '../../src/health/health.service';

function build(opts: { requireWorker: boolean; heartbeat?: string | null; version?: string }) {
  const pool = { query: vi.fn().mockResolvedValue({}) };
  const redis = {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(opts.heartbeat ?? null),
  };
  const values: Record<string, unknown> = {
    MINIO_ENDPOINT: 'http://minio.test',
    HEALTH_REQUIRE_WORKER: opts.requireWorker,
    GIT_SHA: opts.version,
  };
  const config = { get: (key: string) => values[key] };
  return { service: new HealthService(pool as never, redis as never, config as never), redis };
}

describe('HealthService', () => {
  afterEach(() => vi.unstubAllGlobals());
  const storageUp = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

  it('reports ok with the build version and no worker check by default', async () => {
    storageUp();
    const { service, redis } = build({ requireWorker: false, version: 'abc123' });
    const res = await service.check();
    expect(res.status).toBe('ok');
    expect(res.version).toBe('abc123');
    expect(res.checks.worker).toBeUndefined();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('falls back to "dev" without a version', async () => {
    storageUp();
    expect((await build({ requireWorker: false }).service.check()).version).toBe('dev');
  });

  it('is ok when the worker heartbeat is fresh', async () => {
    storageUp();
    const { service } = build({ requireWorker: true, heartbeat: String(Date.now() - 10_000) });
    const res = await service.check();
    expect(res.status).toBe('ok');
    expect(res.checks.worker?.status).toBe('up');
  });

  it('degrades when the worker heartbeat is stale or missing', async () => {
    storageUp();
    const stale = await build({ requireWorker: true, heartbeat: String(Date.now() - 5 * 60_000) }).service.check();
    expect(stale.status).toBe('degraded');
    expect(stale.checks.worker).toMatchObject({ status: 'down', error: 'worker heartbeat is stale' });

    const missing = await build({ requireWorker: true, heartbeat: null }).service.check();
    expect(missing.status).toBe('degraded');
  });

  it('degrades when storage is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const res = await build({ requireWorker: false }).service.check();
    expect(res.status).toBe('degraded');
    expect(res.checks.storage.status).toBe('down');
  });
});