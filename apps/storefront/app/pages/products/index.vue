<script setup lang="ts">
import type { CategoryDto } from '@myapp/shared-types';

const store = useStore();
const api = useStorefrontApi();
const siteUrl = useSiteUrl();

const { data, error, filters } = await useProductListing({ key: 'products' });

const { data: categories } = await useAsyncData('products-categories', () =>
  api<CategoryDto[]>('/storefront/categories'),
);
const rootCategories = computed(() => visibleRootCategories(categories.value ?? []));

const heading = computed(() =>
  filters.value.q ? `نتایج جستجو برای «${filters.value.q}»` : 'همه‌ی محصولات',
);
const pageSuffix = computed(() =>
  filters.value.page > 1 ? ` (صفحه ${formatNumber(filters.value.page)})` : '',
);
const noIndex = computed(() => Boolean(filters.value.q) || !data.value?.items.length);

useSeoMeta({
  title: () => `${heading.value}${pageSuffix.value}`,
  description: () =>
    filters.value.q ? undefined : `فهرست محصولات ${store.value?.name ?? ''}`.trim(),
  robots: () => (noIndex.value ? 'noindex, follow' : undefined),
});

useHead(() => ({
  link: filters.value.q
    ? []
    : [
        {
          rel: 'canonical',
          href: siteUrl(filters.value.page > 1 ? `/products?page=${filters.value.page}` : '/products'),
        },
      ],
}));
</script>

<template>
  <div class="space-y-6">
    <Breadcrumbs :items="[{ label: 'خانه', to: '/' }, { label: 'محصولات' }]" />

    <h1 class="text-2xl font-extrabold">{{ heading }}</h1>

    <div v-if="rootCategories.length" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="c in rootCategories"
        :key="c.id"
        :to="`/categories/${encodeURIComponent(c.slug)}`"
        class="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm transition hover:border-brand-500 hover:text-brand-700"
      >
        {{ c.name }}
      </NuxtLink>
    </div>

    <ProductListing
      :data="data"
      :error="error"
      :sort="filters.sort"
      :empty-text="filters.q ? 'محصولی با این عبارت پیدا نشد. عبارت دیگری را امتحان کنید.' : 'این فروشگاه هنوز محصولی ندارد.'"
    />
  </div>
</template>