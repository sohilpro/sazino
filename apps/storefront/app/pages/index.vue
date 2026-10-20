<script setup lang="ts">
useSeoMeta({
  title: 'فروشگاه',
  description: 'صفحه‌ی اصلی فروشگاه',
});
</script>

<template>
  <div class="space-y-8">
    <div class="rounded-2xl bg-brand-50 p-10 text-center">
      <h1 class="text-3xl font-extrabold text-brand-700">به فروشگاه خوش آمدید</h1>
      <p class="mt-3 text-slate-600">Storefront با Nuxt 4 و Tailwind 4 بالا آمد ✅</p>
    </div>

    <ApiStatus />
  </div>
</template>