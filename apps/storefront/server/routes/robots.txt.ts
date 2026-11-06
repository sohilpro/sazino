import type { StoreInfo } from '@myapp/shared-types';
import { apiFetch, upstreamStatus } from '../utils/api';
import { buildRobotsTxt } from '../utils/sitemap';

export default defineEventHandler(async (event) => {
  let origin: string | null;
  try {
    origin = (await apiFetch<StoreInfo>(event, '/store')).canonicalUrl;
  } catch (error) {
    const status = upstreamStatus(error);
    if (status !== undefined && status >= 400 && status < 500) origin = null;
    else throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' });
  }

  setResponseHeaders(event, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'public, max-age=3600',
    vary: 'Host',
  });
  return buildRobotsTxt({ origin });
});