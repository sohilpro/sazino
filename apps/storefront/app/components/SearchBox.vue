<script setup lang="ts">
const route = useRoute();

const term = ref(route.path === '/products' ? firstQuery(route.query.q) : '');

// فیلد با URL هماهنگ می‌ماند (دکمه‌ی برگشت، پاک‌شدن جستجو، ...)
watch(
  () => [route.path, route.query.q] as const,
  ([path, q]) => {
    term.value = path === '/products' ? firstQuery(q) : '';
  },
);

async function submit() {
  const q = term.value.trim().slice(0, 100);
  await navigateTo({ path: '/products', query: q ? { q } : {} });
}
</script>

<template>
  <form role="search" class="relative w-full" @submit.prevent="submit">
    <label class="sr-only" for="site-search">جستجو در فروشگاه</label>
    <input
      id="site-search"
      v-model="term"
      type="search"
      maxlength="100"
      enterkeyhint="search"
      placeholder="جستجوی محصول…"
      class="w-full rounded-full border border-slate-300 bg-white py-2 ps-4 pe-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    />
    <button
      type="submit"
      aria-label="جستجو"
      class="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-slate-500 hover:text-brand-700"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  </form>
</template>