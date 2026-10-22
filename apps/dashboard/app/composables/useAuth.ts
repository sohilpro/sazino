import type { AuthSession, AuthTenant, AuthUser } from '@myapp/shared-types';

interface AuthState {
  accessToken: string | null;
  /** زمان انقضای access token (میلی‌ثانیه) */
  expiresAt: number;
  user: AuthUser | null;
  tenant: AuthTenant | null;
}

export interface RegisterPayload {
  storeName: string;
  subdomain: string;
  name: string;
  email: string;
  password: string;
}

/**
 * refreshهای هم‌زمان باید یک درخواست واحد باشند (single-flight)؛
 * وگرنه سرور استفاده‌ی دوباره از refresh token قدیمی را سرقت فرض می‌کند و نشست را باطل می‌کند.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function useAuth() {
  const config = useRuntimeConfig();
  const state = useState<AuthState>('auth', () => ({
    accessToken: null,
    expiresAt: 0,
    user: null,
    tenant: null,
  }));

  const user = computed(() => state.value.user);
  const tenant = computed(() => state.value.tenant);
  const isAuthenticated = computed(() => Boolean(state.value.accessToken && state.value.user));
  const canDelete = computed(
    () => state.value.user?.role === 'OWNER' || state.value.user?.role === 'ADMIN',
  );

  function apply(session: AuthSession) {
    state.value = {
      accessToken: session.accessToken,
      expiresAt: Date.now() + session.expiresIn * 1000,
      user: session.user,
      tenant: session.tenant,
    };
  }

  function clear() {
    state.value = { accessToken: null, expiresAt: 0, user: null, tenant: null };
  }

  function post<T>(path: string, body?: Record<string, unknown>) {
    return $fetch<T>(path, {
      method: 'POST',
      baseURL: config.public.apiBase,
      credentials: 'include', // کوکی refresh_token (httpOnly) را می‌فرستد و می‌گیرد
      body,
    });
  }

  async function login(email: string, password: string) {
    apply(await post<AuthSession>('/auth/login', { email, password }));
  }

  async function register(payload: RegisterPayload) {
    apply(await post<AuthSession>('/auth/register', { ...payload }));
  }

  /** نشست را از روی کوکی refresh تمدید می‌کند؛ true اگر موفق بود */
  function refresh(): Promise<boolean> {
    refreshInFlight ??= (async () => {
      try {
        apply(await post<AuthSession>('/auth/refresh'));
        return true;
      } catch {
        clear();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  /** اگر کمتر از ۲۰ ثانیه به انقضای توکن مانده، پیشگیرانه تمدید می‌کند */
  async function ensureFresh(): Promise<void> {
    if (state.value.accessToken && state.value.expiresAt - Date.now() < 20_000) {
      await refresh();
    }
  }

  function authHeader(): Record<string, string> {
    const token = state.value.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function logout() {
    try {
      await post('/auth/logout');
    } catch {
      // حتی اگر سرور در دسترس نبود، نشست محلی پاک می‌شود
    }
    clear();
    await navigateTo('/login');
  }

  return {
    state,
    user,
    tenant,
    isAuthenticated,
    canDelete,
    login,
    register,
    refresh,
    ensureFresh,
    authHeader,
    logout,
  };
}