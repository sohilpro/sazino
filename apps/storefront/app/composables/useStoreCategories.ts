import type { CategoryDto } from '@myapp/shared-types';

/** دسته‌بندی‌های فروشگاه؛ با یک کلید مشترک بین هدر، فوتر و صفحه‌ی محصولات. خطا نباید کل ویترین را بشکند. */
export async function useStoreCategories() {
  const api = useStorefrontApi();
  const { data } = await useAsyncData('products-categories', () =>
    api<CategoryDto[]>('/storefront/categories').catch(() => [] as CategoryDto[]),
  );
  const roots = computed(() => visibleRootCategories(data.value ?? []));
  return { categories: data, roots };
}
