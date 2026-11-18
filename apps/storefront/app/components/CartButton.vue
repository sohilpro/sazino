<script setup lang="ts">
const { count } = useCart();
</script>

<template>
  <NuxtLink
    to="/cart"
    class="icon-btn"
    :aria-label="count ? `سبد خرید، ${formatNumber(count)} کالا` : 'سبد خرید'"
  >
    <StoreIcon name="cart" :size="24" />
    <span
      v-if="count > 0"
      class="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-on-brand"
    >
      {{ formatNumber(count) }}
    </span>
  </NuxtLink>
</template>
