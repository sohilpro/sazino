<script setup lang="ts">
import type { ProductDto } from '@myapp/shared-types';

const props = defineProps<{ product: ProductDto }>();

const image = computed(() => props.product.images[0]);
const discount = computed(() => discountInfo(props.product));
</script>

<template>
  <NuxtLink
    :to="`/products/${encodeURIComponent(product.slug)}`"
    class="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md"
  >
    <div class="relative aspect-square overflow-hidden bg-slate-100">
      <img
        v-if="image"
        :src="image.urls.sm"
        :alt="image.alt || product.title"
        loading="lazy"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
        :class="!product.inStock && 'opacity-50'"
      />
      <div v-else class="flex size-full items-center justify-center text-sm text-slate-400">
        بدون تصویر
      </div>

      <span v-if="discount" class="badge absolute start-2 top-2 bg-red-600 text-white">
        {{ formatNumber(discount.percent) }}٪ تخفیف
      </span>
      <span v-if="!product.inStock" class="badge absolute end-2 top-2 bg-slate-800 text-white">
        ناموجود
      </span>
    </div>

    <div class="space-y-1 p-3">
      <h3 class="line-clamp-2 min-h-10 text-sm font-medium">{{ product.title }}</h3>
      <div class="text-sm font-bold text-brand-700">
        <span v-if="product.minPrice !== product.maxPrice" class="font-normal text-slate-500">از </span>
        {{ formatPrice(product.minPrice) }}
      </div>
      <div v-if="discount" class="text-xs text-slate-400 line-through">
        {{ formatPrice(discount.compareAt) }}
      </div>
    </div>
  </NuxtLink>
</template>