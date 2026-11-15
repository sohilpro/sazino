<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; backTo?: string; backLabel?: string }>();
</script>

<template>
  <header class="space-y-2">
    <NuxtLink
      v-if="backTo"
      :to="backTo"
      class="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-brand-600"
    >
      <AppIcon name="arrowRight" :size="16" />
      {{ backLabel ?? 'بازگشت' }}
    </NuxtLink>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="page-title">{{ title }}</h1>
          <slot name="meta" />
        </div>
        <p v-if="subtitle" class="mt-0.5 text-sm text-slate-500">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-2"><slot /></div>
    </div>
  </header>
</template>
