type Primitive = string | number | boolean | null | undefined;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  query?: Record<string, Primitive>;
}

/** کلاینت API با توکن، تمدید خودکار و یک‌بار تلاش مجدد روی 401. باید داخل setup فراخوانی شود. */
export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuth();
  const route = useRoute();

  function send<T>(path: string, opts: ApiOptions): Promise<T> {
    const query = opts.query
      ? Object.fromEntries(
          Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        )
      : undefined;

    return $fetch<T>(path, {
      method: opts.method ?? 'GET',
      body: opts.body,
      query,
      baseURL: config.public.apiBase,
      credentials: 'include',
      headers: auth.authHeader(),
    });
  }

  return async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    await auth.ensureFresh();
    try {
      return await send<T>(path, opts);
    } catch (err) {
      // فروشگاه توسط پلتفرم تعلیق شده: نشست محلی بسته و به صفحه‌ی ورود با پیام می‌رویم
      if (statusOf(err) === 403 && codeOf(err) === 'TENANT_SUSPENDED') {
        auth.clear();
        await navigateTo({ path: '/login', query: { suspended: '1' } });
        throw err;
      }
      if (statusOf(err) !== 401) throw err;

      // توکن منقضی یا باطل شده: یک‌بار تمدید و تلاش مجدد
      if (await auth.refresh()) return await send<T>(path, opts);

      await navigateTo({ path: '/login', query: { redirect: route.fullPath } });
      throw err;
    }
  };
}
