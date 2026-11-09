import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createRequestLogger, resolveRequestId } from '../../src/common/logging/request-log';

function run(opts: {
  headers?: Record<string, string>;
  url?: string;
  status?: number;
  user?: { tenantId?: string; role?: string };
  skip?: (path: string) => boolean;
}) {
  const writes: Array<{ level: string; fields: Record<string, unknown> }> = [];
  const sink = { write: (level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) => writes.push({ level, fields }) };
  const res = Object.assign(new EventEmitter(), { statusCode: opts.status ?? 200, setHeader: vi.fn() });
  const req = {
    headers: { host: 'demo.localhost:4000', ...(opts.headers ?? {}) },
    originalUrl: opts.url ?? '/api/store?token=abc&phone=09123456789',
    method: 'GET',
    ip: '1.2.3.4',
    user: opts.user,
  } as unknown as Request;
  const next = vi.fn();
  createRequestLogger(sink, { skip: opts.skip })(req, res as unknown as Response, next);
  res.emit('finish');
  return { writes, res, req, next };
}

describe('request id', () => {
  it('keeps a safe incoming id and replaces unsafe ones', () => {
    expect(resolveRequestId('abc-12345678')).toBe('abc-12345678');
    expect(resolveRequestId('short')).not.toBe('short');
    expect(resolveRequestId('bad id\nwith newline')).not.toContain('\n');
    expect(resolveRequestId('x'.repeat(200))).toHaveLength(36);
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('createRequestLogger', () => {
  it('sets the response header and continues', () => {
    const { res, next, req } = run({});
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(next).toHaveBeenCalledOnce();
    expect((req as unknown as { id: string }).id).toBeTruthy();
  });

  it('logs the path without the query string and never the body', () => {
    const { writes } = run({});
    expect(writes).toHaveLength(1);
    expect(writes[0]?.fields).toMatchObject({ msg: 'http', method: 'GET', path: '/api/store', status: 200, ip: '1.2.3.4' });
    expect(JSON.stringify(writes[0]?.fields)).not.toContain('token');
    expect(JSON.stringify(writes[0]?.fields)).not.toContain('09123456789');
  });

  it('uses the tenant host header when present', () => {
    const { writes } = run({ headers: { 'x-tenant-host': 'shop.example.com' } });
    expect(writes[0]?.fields.host).toBe('shop.example.com');
  });

  it('maps status codes to levels', () => {
    expect(run({ status: 200 }).writes[0]?.level).toBe('info');
    expect(run({ status: 404 }).writes[0]?.level).toBe('warn');
    expect(run({ status: 429 }).writes[0]?.level).toBe('warn');
    expect(run({ status: 500 }).writes[0]?.level).toBe('error');
  });

  it('reads the tenant from the authenticated user at the end of the request', () => {
    const { writes } = run({ user: { tenantId: 't-1', role: 'OWNER' } });
    expect(writes[0]?.fields).toMatchObject({ tenantId: 't-1', role: 'OWNER' });
  });

  it('can skip noisy paths', () => {
    const { writes } = run({ url: '/api/health/live', skip: (p) => p.startsWith('/api/health') });
    expect(writes).toHaveLength(0);
  });
});