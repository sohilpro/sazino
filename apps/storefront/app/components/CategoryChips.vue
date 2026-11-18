<script setup lang="ts">
import type { CategoryDto } from '@myapp/shared-types';

defineProps<{
  items: CategoryDto[];
  /** چیپ «همه» که به /products می‌رود */
  showAll?: boolean;
  activeSlug?: string;
}>();

const base = 'rounded-full border px-4 py-1.5 text-sm transition';
const idle = 'border-slate-300 bg-white hover:border-brand-500 hover:text-brand-700';
const current = 'border-brand-600 bg-brand-600 text-on-brand';
</script>

<template>
  <div v-if="items.length" class="flex flex-wrap gap-2">
    <NuxtLink v-if="showAll" to="/products" :class="[base, activeSlug ? idle : current]">همه</NuxtLink>
    <NuxtLink
      v-for="c in items"
      :key="c.id"
      :to="`/categories/${encodeURIComponent(c.slug)}`"
      :class="[base, c.slug === activeSlug ? current : idle]"
    >
      {{ c.name }}
    </NuxtLink>
  </div>
</template>
