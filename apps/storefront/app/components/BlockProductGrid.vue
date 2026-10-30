<script setup lang="ts">
import type { Paginated, ProductDto, ProductGridBlock } from '@myapp/shared-types';

const props = defineProps<{ block: ProductGridBlock }>();

const route = useRoute();
const api = useStorefrontApi();
const p = computed(() => props.block.props);

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-3 lg:grid-cols-4',
} as const;

// کلید شامل مسیر و تنظیمات: بلاک‌های هم‌شناسه در صفحه‌های مختلف یا بعد از ویرایش قاطی نمی‌شوند
const key = `page-grid:${route.path}:${props.block.id}:${p.value.source}:${p.value.categorySlug ?? ''}:${p.value.limit}`;

const { data } = await useAsyncData(key, () =>
  api<Paginated<ProductDto>>('/storefront/products', {
    query: {
      limit: p.value.limit,
      sort: 'newest',
      categorySlug: p.value.source === 'category' ? p.value.categorySlug : undefined,
    },
  }).catch(() => null),
);
</script>

<template>
  <!-- بلاک بدون محصول (دسته‌ی خالی یا خطای موقت) اصلاً نمایش داده نمی‌شود -->
  <section v-if="data?.items.length" class="space-y-4">
    <div v-if="p.title" class="flex items-center justify-between">
      <h2 class="text-xl font-bold">{{ p.title }}</h2>
      <NuxtLink
        :to="p.source === 'category' && p.categorySlug ? `/categories/${encodeURIComponent(p.categorySlug)}` : '/products'"
        class="text-sm text-brand-700 hover:underline"
      >
        مشاهده‌ی همه
      </NuxtLink>
    </div>

    <div class="grid grid-cols-2 gap-4" :class="COLUMNS[p.columns]">
      <ProductCard v-for="product in data.items" :key="product.id" :product="product" />
    </div>
  </section>
</template>