import * as Sentry from '@sentry/browser';
import { scrubSentryEvent, type SentryEventLike } from '../../shared/sentry-scrub';

export default defineNuxtPlugin(() => {
  const dsn = String(useRuntimeConfig().public.sentryDsn ?? '');
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend: (event) =>
      scrubSentryEvent(event as unknown as SentryEventLike) as unknown as typeof event,
  });
});
