<script setup lang="ts">
const { customer, loaded } = useCustomer();
</script>

<template>
  <NuxtLink v-if="loaded && customer" to="/account" class="text-sm hover:text-brand-700">
    {{ customer.name || 'حساب من' }}
  </NuxtLink>
  <NuxtLink v-else-if="loaded" to="/login" class="text-sm hover:text-brand-700">ورود</NuxtLink>
  <span v-else class="inline-block w-10" aria-hidden="true" />
</template>