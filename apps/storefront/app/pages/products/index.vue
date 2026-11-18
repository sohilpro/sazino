<script setup lang="ts">
const store = useStore();
const siteUrl = useSiteUrl();

const { data, error, filters } = await useProductListing({ key: 'products' });

const { roots: rootCategories } = await useStoreCategories();

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

    <header class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ heading }}</h1>
      <NuxtLink v-if="filters.q" to="/products" class="btn btn-ghost btn-sm">پاک کردن جستجو</NuxtLink>
    </header>

    <CategoryChips :items="rootCategories" show-all />

    <ProductListing
      :data="data"
      :error="error"
      :sort="filters.sort"
      :empty-text="filters.q ? 'محصولی با این عبارت پیدا نشد. عبارت دیگری را امتحان کنید.' : 'این فروشگاه هنوز محصولی ندارد.'"
    />
  </div>
</template>
