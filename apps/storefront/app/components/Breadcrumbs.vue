<script setup lang="ts">
import type { Crumb } from '~/utils/seo';

defineProps<{ items: Crumb[] }>();
</script>

<template>
  <nav aria-label="مسیر صفحه" class="text-sm text-slate-500">
    <ol class="flex flex-wrap items-center gap-1.5">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1.5">
        <StoreIcon v-if="i > 0" name="chevronLeft" :size="14" class="text-slate-300" />
        <NuxtLink v-if="item.to" :to="item.to" class="transition hover:text-brand-700">{{ item.label }}</NuxtLink>
        <span v-else aria-current="page" class="text-slate-700">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
