import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
/** فقط شناسه‌ی کوتاه و امن پذیرفته می‌شود (جلوگیری از تزریق در لاگ) */
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export type RequestWithId = Request & {
  id?: string;
  user?: { id?: string; tenantId?: string; role?: string };
};

export interface RequestLogSink {
  write(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>): void;
}

export function resolveRequestId(incoming: string | string[] | undefined): string {
  return typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
}

/** شناسه‌ی درخواست می‌گذارد و در پایان هر درخواست یک لاگ می‌نویسد (بدون query و بدن) */
export function createRequestLogger(
  sink: RequestLogSink,
  opts: { skip?: (path: string) => boolean } = {},
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const request = req as RequestWithId;
    const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    request.id = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();

    res.on('finish', () => {
      const path = (req.originalUrl ?? req.url).split('?')[0] ?? '/';
      if (opts.skip?.(path)) return;

      const status = res.statusCode;
      const host = req.headers['x-tenant-host'] ?? req.headers.host;
      sink.write(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', {
        msg: 'http',
        requestId: id,
        method: req.method,
        path,
        status,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        ip: req.ip,
        host: typeof host === 'string' ? host : undefined,
        // req.user را JwtAuthGuard بعد از middleware می‌گذارد؛ در finish در دسترس است
        tenantId: request.user?.tenantId,
        role: request.user?.role,
      });
    });

    next();
  };
}