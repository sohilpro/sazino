import * as Sentry from '@sentry/node';
import { scrubSentryEvent, type SentryEventLike } from '../../shared/sentry-scrub';

export default defineNitroPlugin((nitroApp) => {
  const dsn = String(useRuntimeConfig().sentryDsn ?? '');
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.GIT_SHA,
    tracesSampleRate: 0,
    beforeSend: (event) =>
      scrubSentryEvent(event as unknown as SentryEventLike) as unknown as typeof event,
  });

  nitroApp.hooks.hook('error', (error, context) => {
    // ۴۰۴ و خطاهای کلاینت (۴xx) خطای برنامه نیستند
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status < 500) return;
    Sentry.withScope((scope) => {
      scope.setTag('route', context?.event?.path?.split('?')[0] ?? 'unknown');
      Sentry.captureException(error);
    });
  });
});
