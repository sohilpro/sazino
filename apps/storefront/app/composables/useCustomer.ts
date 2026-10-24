import type { CustomerDto, CustomerSessionResponse, OtpRequestResponse } from '@myapp/shared-types';

interface CustomerState {
  customer: CustomerDto | null;
  /** تا وقتی false است نمی‌دانیم کاربر وارد شده یا نه */
  loaded: boolean;
}

const BASE = '/api/storefront';

/** فقط سمت مرورگر صدا زده می‌شود */
export function useCustomer() {
  const state = useState<CustomerState>('customer', () => ({ customer: null, loaded: false }));
  const cart = useCart();

  const customer = computed(() => state.value.customer);
  const loaded = computed(() => state.value.loaded);
  const isLoggedIn = computed(() => state.value.customer !== null);

  async function load() {
    try {
      const res = await $fetch<CustomerSessionResponse>(`${BASE}/auth/session`);
      state.value = { customer: res.customer, loaded: true };
    } catch {
      state.value = { customer: null, loaded: true };
    }
  }

  const requestOtp = (phone: string) =>
    $fetch<OtpRequestResponse>(`${BASE}/auth/otp`, { method: 'POST', body: { phone } });

  async function verify(phone: string, code: string) {
    const res = await $fetch<CustomerSessionResponse>(`${BASE}/auth/verify`, {
      method: 'POST',
      body: { phone, code },
    });
    state.value = { customer: res.customer, loaded: true };
    await cart.load(); // سبد مهمان ادغام شده است
  }

  async function logout() {
    try {
      await $fetch(`${BASE}/auth/logout`, { method: 'POST' });
    } catch {
      // حتی اگر درخواست نرسید، نشست محلی پاک می‌شود
    }
    state.value = { customer: null, loaded: true };
    await cart.load();
  }

  async function updateName(name: string) {
    const updated = await $fetch<CustomerDto>(`${BASE}/customer`, { method: 'PATCH', body: { name } });
    state.value = { customer: updated, loaded: true };
  }

  return { customer, loaded, isLoggedIn, load, requestOtp, verify, logout, updateName };
}