import { normalizeCachedUrl } from '../utils/cache-query';

export default defineEventHandler((event) => {
  if (import.meta.dev) return;
  if (event.method !== 'GET' && event.method !== 'HEAD') return;

  const req = event.node.req;
  const current = req.url ?? '/';
  const next = normalizeCachedUrl(current);
  if (next === current) return;

  req.url = next;
  if (req.originalUrl) req.originalUrl = next;
  const internal = event as unknown as { _path?: string };
  if (internal._path !== undefined) internal._path = next;
});