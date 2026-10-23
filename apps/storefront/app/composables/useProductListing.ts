import type { MaybeRefOrGetter } from 'vue';
import type { Paginated, ProductDto } from '@myapp/shared-types';

export const LISTING_PAGE_SIZE = 12;

interface Options {
  /** کلید یکتای کش داده؛ می‌تواند reactive باشد */
  key: MaybeRefOrGetter<string>;
  categorySlug?: MaybeRefOrGetter<string | undefined>;
}

/** لیست محصولات با page، q و sort از روی URL. باید با await در سطح بالای setup صدا زده شود. */
export async function useProductListing(options: Options) {
  const route = useRoute();
  const api = useStorefrontApi();

  const filters = computed(() => {
    const page = Math.floor(Number(route.query.page));
    const sort = firstQuery(route.query.sort);
    return {
      page: page > 0 && page <= 100_000 ? page : 1,
      q: firstQuery(route.query.q).trim().slice(0, 100),
      sort: isSortValue(sort) ? sort : 'newest',
    };
  });

  const asyncData = useAsyncData(
    () => toValue(options.key),
    () =>
      api<Paginated<ProductDto>>('/storefront/products', {
        query: {
          page: filters.value.page,
          limit: LISTING_PAGE_SIZE,
          q: filters.value.q,
          sort: filters.value.sort,
          categorySlug: toValue(options.categorySlug),
        },
      }),
    { watch: [filters] },
  );

  // با رفتن به صفحه‌ی دیگر، بالای لیست
  watch(
    () => filters.value.page,
    () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  );

  await asyncData;
  return { filters, data: asyncData.data, error: asyncData.error };
}