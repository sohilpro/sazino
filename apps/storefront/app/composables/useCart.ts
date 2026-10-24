import type { CartDto } from '@myapp/shared-types';

const emptyCart = (): CartDto => ({ items: [], itemCount: 0, subtotal: 0, hasIssues: false });
const BASE = '/api/storefront/cart';

/** فقط سمت مرورگر صدا زده می‌شود (سبد شخصی است و در HTML سرور نیست) */
export function useCart() {
  const cart = useState<CartDto | null>('cart', () => null);
  const busy = useState<boolean>('cart-busy', () => false);
  const count = computed(() => cart.value?.itemCount ?? 0);

  async function load() {
    try {
      cart.value = await $fetch<CartDto>(BASE);
    } catch {
      cart.value ??= emptyCart();
    }
  }

  async function run(request: () => Promise<CartDto>) {
    busy.value = true;
    try {
      cart.value = await request();
    } finally {
      busy.value = false;
    }
  }

  const add = (variantId: string, quantity = 1) =>
    run(() => $fetch<CartDto>(`${BASE}/items`, { method: 'POST', body: { variantId, quantity } }));

  const setQuantity = (variantId: string, quantity: number) =>
    run(() =>
      $fetch<CartDto>(`${BASE}/items/${variantId}`, { method: 'PATCH', body: { quantity } }),
    );

  const remove = (variantId: string) =>
    run(() => $fetch<CartDto>(`${BASE}/items/${variantId}`, { method: 'DELETE' }));

  return { cart, busy, count, load, add, setQuantity, remove };
}