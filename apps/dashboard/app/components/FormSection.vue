<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="card space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-sm text-slate-500">{{ description }}</p>
      </div>
      <slot name="aside" />
    </div>
    <slot />
  </section>
</template>
