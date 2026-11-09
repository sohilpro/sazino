import * as Sentry from '@sentry/node';
import { scrubSentryEvent, type SentryEventLike } from './sentry-scrub';

/** بدون DSN هیچ کاری نمی‌کند؛ captureServerError هم در آن حالت بی‌اثر است */
export function initSentry(opts: { dsn?: string; environment: string; release?: string }): boolean {
  if (!opts.dsn) return false;
    Sentry.init({
    dsn: opts.dsn,
    environment: opts.environment,
    release: opts.release,
    tracesSampleRate: 0,
    beforeSend: (event) =>
      scrubSentryEvent(event as unknown as SentryEventLike) as unknown as typeof event,
  });
  return true;
}

export function captureServerError(
  error: unknown,
  context: { requestId?: string; tenantId?: string; route?: string },
): void {
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.tenantId) scope.setTag('tenantId', context.tenantId);
    if (context.route) scope.setTag('route', context.route);
    Sentry.captureException(error);
  });
}