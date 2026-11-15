<script setup lang="ts">
const model = defineModel<string>({ required: true });
defineProps<{ placeholder?: string }>();
</script>

<template>
  <div class="relative">
    <AppIcon
      name="search"
      :size="18"
      class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
    />
    <input v-model="model" type="search" class="input !ps-10" :placeholder="placeholder" />
  </div>
</template>
