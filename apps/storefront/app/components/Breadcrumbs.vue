<script setup lang="ts">
import type { Crumb } from '~/utils/seo';

defineProps<{ items: Crumb[] }>();
</script>

<template>
  <nav aria-label="مسیر صفحه" class="text-sm text-slate-500">
    <ol class="flex flex-wrap items-center gap-1.5">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1.5">
        <span v-if="i > 0" aria-hidden="true">‹</span>
        <NuxtLink v-if="item.to" :to="item.to" class="hover:text-brand-700">{{ item.label }}</NuxtLink>
        <span v-else aria-current="page" class="text-slate-700">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>