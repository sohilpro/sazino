import { canonicalRedirectTarget, shouldSkipCanonical } from '../utils/canonical';
import { requestHost } from '../utils/api';
import { getCanonicalUrl } from '../utils/store-info-cache';

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).canonicalRedirect) return;
  if (event.method !== 'GET' && event.method !== 'HEAD') return;
  if (shouldSkipCanonical(event.path)) return;

  const target = canonicalRedirectTarget({
    host: requestHost(event),
    path: event.path,
    canonicalUrl: await getCanonicalUrl(event),
  });
  if (target) return sendRedirect(event, target, 301);
});