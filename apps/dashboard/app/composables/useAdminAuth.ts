import type { AdminDto } from '@myapp/shared-types';

interface AdminState {
  admin: AdminDto | null;
  /** تا وقتی false است نمی‌دانیم ادمین وارد شده یا نه */
  loaded: boolean;
}

/** نشست سوپر ادمین (کوکی httpOnly)؛ کاملاً جدا از نشست فروشنده */
export function useAdminAuth() {
  const config = useRuntimeConfig();
  const state = useState<AdminState>('admin-auth', () => ({ admin: null, loaded: false }));

  const admin = computed(() => state.value.admin);
  const loaded = computed(() => state.value.loaded);

  const request = <T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) =>
    $fetch<T>(path, { method, body, baseURL: config.public.apiBase, credentials: 'include' });

  function clear() {
    state.value = { admin: null, loaded: true };
  }

  async function load() {
    try {
      state.value = { admin: await request<AdminDto>('/admin/auth/me', 'GET'), loaded: true };
    } catch {
      clear();
    }
  }

  async function login(email: string, password: string) {
    state.value = { admin: await request<AdminDto>('/admin/auth/login', 'POST', { email, password }), loaded: true };
  }

  async function logout() {
    try {
      await request('/admin/auth/logout', 'POST');
    } catch {
      // حتی اگر درخواست نرسید، نشست محلی پاک می‌شود
    }
    clear();
    await navigateTo('/admin/login');
  }

  return { admin, loaded, load, login, logout, clear };
}