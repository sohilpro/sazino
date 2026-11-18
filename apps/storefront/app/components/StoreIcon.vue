<script setup lang="ts">
const PATHS = {
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-3.5-3.5'],
  cart: ['M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2', 'M9.5 20.5a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4ZM17 20.5a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20a8 8 0 0 1 16 0'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M18 6 6 18'],
  chevronLeft: ['m15 6-6 6 6 6'],
  chevronRight: ['m9 6 6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  box: ['m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z', 'm4 7.5 8 4.5 8-4.5M12 12v9'],
  alert: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 8v5M12 16h.01'],
} as const;

export type StoreIconName = keyof typeof PATHS;

const props = withDefaults(defineProps<{ name: StoreIconName; size?: number }>(), { size: 22 });
const paths = computed(() => PATHS[props.name]);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>
