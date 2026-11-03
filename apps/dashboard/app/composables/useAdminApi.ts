import type { ApiOptions } from '~/composables/useApi';

/** کلاینت API سوپر ادمین (کوکی نشست). روی ۴۰۱ به صفحه‌ی ورود ادمین می‌رود. باید داخل setup فراخوانی شود. */
export function useAdminApi() {
  const config = useRuntimeConfig();
  const auth = useAdminAuth();
  const route = useRoute();

  return async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const query = opts.query
      ? Object.fromEntries(
          Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        )
      : undefined;

    try {
      return await $fetch<T>(path, {
        method: opts.method ?? 'GET',
        body: opts.body,
        query,
        baseURL: config.public.apiBase,
        credentials: 'include',
      });
    } catch (err) {
      if (statusOf(err) === 401) {
        auth.clear();
        await navigateTo({ path: '/admin/login', query: { redirect: route.fullPath } });
      }
      throw err;
    }
  };
}