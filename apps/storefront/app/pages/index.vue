<script setup lang="ts">
import type { CategoryDto, Paginated, ProductDto } from '@myapp/shared-types';

const store = useStore();
const api = useStorefrontApi();

const { data, error } = await useAsyncData('home', async () => {
  const [products, categories] = await Promise.all([
    api<Paginated<ProductDto>>('/storefront/products', { query: { limit: 12, sort: 'newest' } }),
    api<CategoryDto[]>('/storefront/categories'),
  ]);
  return { products: products.items, categories: visibleRootCategories(categories) };
});

useSeoMeta({
  title: () => store.value?.name,
  description: () => store.value?.description ?? undefined,
  ogTitle: () => store.value?.name,
  ogDescription: () => store.value?.description ?? undefined,
  ogImage: () => store.value?.logoUrl ?? undefined,
});
</script>

<template>
  <div class="space-y-10">
    <section class="rounded-3xl bg-linear-to-b from-brand-50 to-white p-8 text-center sm:p-14">
      <h1 class="text-3xl font-extrabold text-brand-700 sm:text-4xl">{{ store?.name }}</h1>
      <p v-if="store?.description" class="mx-auto mt-3 max-w-xl text-slate-600">
        {{ store.description }}
      </p>
      <NuxtLink to="/products" class="btn btn-primary mt-6">مشاهده‌ی همه‌ی محصولات</NuxtLink>
    </section>

    <section v-if="data?.categories.length" class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="c in data.categories"
        :key="c.id"
        :to="`/categories/${encodeURIComponent(c.slug)}`"
        class="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm transition hover:border-brand-500 hover:text-brand-700"
      >
        {{ c.name }}
      </NuxtLink>
    </section>

    <section>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold">جدیدترین محصولات</h2>
        <NuxtLink to="/products" class="text-sm text-brand-700 hover:underline">همه‌ی محصولات</NuxtLink>
      </div>

      <p v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        بارگذاری محصولات ناموفق بود. صفحه را دوباره بارگذاری کنید.
      </p>

      <p
        v-else-if="!data?.products.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"
      >
        این فروشگاه هنوز محصولی ندارد.
      </p>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in data.products" :key="p.id" :product="p" />
      </div>
    </section>
  </div>
</template>