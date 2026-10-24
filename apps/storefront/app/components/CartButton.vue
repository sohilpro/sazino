<script setup lang="ts">
const { count } = useCart();
</script>

<template>
  <NuxtLink
    to="/cart"
    class="relative flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-brand-700"
    :aria-label="count ? `سبد خرید، ${formatNumber(count)} کالا` : 'سبد خرید'"
  >
    <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
    <span
      v-if="count > 0"
      class="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-on-brand"
    >
      {{ formatNumber(count) }}
    </span>
  </NuxtLink>
</template>