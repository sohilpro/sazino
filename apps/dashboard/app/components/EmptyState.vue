<script setup lang="ts">
import type { IconName } from '~/components/AppIcon.vue';

withDefaults(defineProps<{ icon?: IconName; title: string; description?: string }>(), {
  icon: 'inbox',
  description: undefined,
});
</script>

<template>
  <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <span class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
      <AppIcon :name="icon" :size="28" />
    </span>
    <h2 class="font-bold text-slate-800">{{ title }}</h2>
    <p v-if="description" class="mx-auto mt-1 max-w-sm text-sm text-slate-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex justify-center gap-2"><slot /></div>
  </div>
</template>
