<script setup lang="ts">
import type { PageMeta } from '@myapp/shared-types';

const props = defineProps<{ meta: PageMeta }>();
const route = useRoute();

const linkTo = (page: number) => ({
  path: route.path,
  query: mergeQuery(route.query, { page: page === 1 ? undefined : page }),
});

/** حداکثر ۵ شماره‌ی اطراف صفحه‌ی فعلی */
const pages = computed(() => {
  const { page, totalPages } = props.meta;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

const base = 'inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm transition';
const idle = 'border-slate-300 bg-white hover:border-brand-500 hover:text-brand-700';
const current = 'border-brand-600 bg-brand-600 font-bold text-on-brand';
</script>

<template>
  <nav
    v-if="meta.totalPages > 1"
    aria-label="صفحه‌بندی"
    class="flex flex-wrap items-center justify-center gap-2"
  >
    <NuxtLink
      v-if="meta.page > 1"
      :to="linkTo(Math.min(meta.page - 1, meta.totalPages))"
      rel="prev"
      :class="[base, idle]"
    >
      <StoreIcon name="chevronRight" :size="16" />
      قبلی
    </NuxtLink>

    <NuxtLink
      v-for="n in pages"
      :key="n"
      :to="linkTo(n)"
      :aria-current="n === meta.page ? 'page' : undefined"
      :class="[base, n === meta.page ? current : idle]"
    >
      {{ formatNumber(n) }}
    </NuxtLink>

    <NuxtLink v-if="meta.page < meta.totalPages" :to="linkTo(meta.page + 1)" rel="next" :class="[base, idle]">
      بعدی
      <StoreIcon name="chevronLeft" :size="16" />
    </NuxtLink>
  </nav>
</template>
