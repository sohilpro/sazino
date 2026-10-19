<script setup lang="ts">
const links = [{ to: '/', label: 'داشبورد' }];
</script>

<template>
  <div class="flex min-h-screen bg-slate-100 text-slate-900">
    <aside class="w-60 shrink-0 border-e border-slate-200 bg-white p-4">
      <div class="mb-8 text-xl font-extrabold text-brand-600">پنل فروشنده</div>
      <nav class="space-y-1">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
          active-class="bg-brand-50 font-semibold text-brand-700"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </aside>

    <main class="flex-1 p-8">
      <slot />
    </main>
  </div>
</template>