<script setup lang="ts">
import type { CategoryDetailDto } from '@myapp/shared-types';
import type { Crumb } from '~/utils/seo';

const route = useRoute();
const api = useStorefrontApi();
const siteUrl = useSiteUrl();

const slug = computed(() => String(route.params.slug));
const path = computed(() => `/categories/${encodeURIComponent(slug.value)}`);

const { data: detail, error } = await useAsyncData(
  () => `category:${slug.value}`,
  () => api<CategoryDetailDto>(`/storefront/categories/${encodeURIComponent(slug.value)}`),
);

if (error.value) {
  throw statusOf(error.value) === 404
    ? notFoundError('Category Not Found')
    : createError({ statusCode: 502, statusMessage: 'Bad Gateway', fatal: true });
}

const { data: products, error: listError, filters } = await useProductListing({
  key: () => `category-products:${slug.value}`,
  categorySlug: slug,
});

const subcategories = computed(() => (detail.value?.children ?? []).filter((c) => (c.productCount ?? 0) > 0));

const crumbs = computed<Crumb[]>(() => {
  const d = detail.value;
  if (!d) return [];
  return [
    { label: 'خانه', to: '/' },
    ...(d.parent ? [{ label: d.parent.name, to: `/categories/${encodeURIComponent(d.parent.slug)}` }] : []),
    { label: d.category.name },
  ];
});

const pageSuffix = computed(() =>
  filters.value.page > 1 ? ` (صفحه ${formatNumber(filters.value.page)})` : '',
);
const canonical = computed(() =>
  siteUrl(filters.value.page > 1 ? `${path.value}?page=${filters.value.page}` : path.value),
);

useSeoMeta({
  title: () => `${detail.value?.category.name ?? ''}${pageSuffix.value}`,
  description: () =>
    plainText(detail.value?.category.description, 160) ||
    (detail.value ? `محصولات دسته‌ی ${detail.value.category.name}` : undefined),
  robots: () => (products.value?.items.length ? undefined : 'noindex, follow'),
});

useHead(() => {
  if (!detail.value) return {};
  return {
    link: [{ rel: 'canonical', href: canonical.value }],
    script: [
      jsonLdScript(
        jsonLdGraph(
          breadcrumbJsonLd(
            crumbs.value.map((c) => ({ name: c.label, url: siteUrl(c.to ?? path.value) })),
          ),
        ),
      ),
    ],
  };
});
</script>

<template>
  <div v-if="detail" class="space-y-6">
    <Breadcrumbs :items="crumbs" />

    <header>
      <h1 class="text-2xl font-extrabold">{{ detail.category.name }}</h1>
      <p v-if="detail.category.description" class="mt-2 max-w-2xl text-slate-600">
        {{ detail.category.description }}
      </p>
    </header>

    <div v-if="subcategories.length" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="c in subcategories"
        :key="c.id"
        :to="`/categories/${encodeURIComponent(c.slug)}`"
        class="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm transition hover:border-brand-500 hover:text-brand-700"
      >
        {{ c.name }}
      </NuxtLink>
    </div>

    <ProductListing
      :data="products"
      :error="listError"
      :sort="filters.sort"
      empty-text="در این دسته‌بندی هنوز محصولی وجود ندارد."
    />
  </div>
</template>