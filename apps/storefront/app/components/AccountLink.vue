<script setup lang="ts">
const { customer, loaded } = useCustomer();
</script>

<template>
  <NuxtLink
    v-if="loaded && customer"
    to="/account"
    class="flex h-10 items-center gap-2 rounded-full px-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-brand-700 sm:px-3"
    :aria-label="customer.name || 'حساب من'"
  >
    <StoreIcon name="user" :size="22" />
    <span class="hidden max-w-28 truncate sm:inline">{{ customer.name || 'حساب من' }}</span>
  </NuxtLink>
  <NuxtLink
    v-else-if="loaded"
    to="/login"
    class="flex h-10 items-center gap-2 rounded-full px-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-brand-700 sm:px-3"
    aria-label="ورود"
  >
    <StoreIcon name="user" :size="22" />
    <span class="hidden sm:inline">ورود</span>
  </NuxtLink>
  <span v-else class="inline-block h-10 w-10" aria-hidden="true" />
</template>
