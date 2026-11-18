<script setup lang="ts">
import type { ProductDto } from '@myapp/shared-types';

const props = defineProps<{ product: ProductDto }>();

const image = computed(() => props.product.images[0]);
const discount = computed(() => discountInfo(props.product));
</script>

<template>
  <NuxtLink
    :to="`/products/${encodeURIComponent(product.slug)}`"
    class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
  >
    <div class="relative aspect-square overflow-hidden bg-slate-100">
      <img
        v-if="image"
        :src="image.urls.sm"
        :alt="image.alt || product.title"
        loading="lazy"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
        :class="!product.inStock && 'opacity-40 grayscale'"
      />
      <div v-else class="flex size-full items-center justify-center text-slate-300">
        <StoreIcon name="box" :size="44" />
      </div>

      <span v-if="discount" class="badge absolute start-2 top-2 bg-rose-600 text-white shadow-sm">
        {{ formatNumber(discount.percent) }}٪ تخفیف
      </span>
      <span
        v-if="!product.inStock"
        class="badge absolute inset-x-0 bottom-3 mx-auto w-fit bg-slate-800/90 px-3 text-white"
      >
        ناموجود
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-1.5 p-3.5">
      <h3 class="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-800">{{ product.title }}</h3>
      <div class="mt-auto">
        <div class="text-sm font-extrabold text-brand-700">
          <span v-if="product.minPrice !== product.maxPrice" class="font-normal text-slate-500">از </span>
          {{ formatPrice(product.minPrice) }}
        </div>
        <div v-if="discount" class="text-xs text-slate-400 line-through">
          {{ formatPrice(discount.compareAt) }}
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
