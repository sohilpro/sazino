<script setup lang="ts">
const store = useStore();

const links = [
  { to: '/', label: 'خانه', exact: true },
  { to: '/products', label: 'محصولات', exact: false },
];

const activeClass = 'text-brand-700 font-semibold';
const initial = computed(() => [...(store.value?.name ?? '?')][0]);
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3">
          <img
            v-if="store?.logoUrl"
            :src="store.logoUrl"
            :alt="store.name"
            class="h-10 w-auto max-w-32 object-contain"
          />
          <span
            v-else
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-extrabold text-on-brand"
          >
            {{ initial }}
          </span>
          <span class="truncate text-lg font-extrabold">{{ store?.name }}</span>
        </NuxtLink>

        <div class="order-3 w-full sm:order-none sm:ms-auto sm:w-72">
          <SearchBox />
        </div>

        <nav class="ms-auto flex items-center gap-4 text-sm text-slate-600 sm:ms-0">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="hover:text-brand-700"
            :active-class="link.exact ? '' : activeClass"
            :exact-active-class="activeClass"
          >
            {{ link.label }}
          </NuxtLink>
          <AccountLink />
          <CartButton />
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="border-t border-slate-200 bg-white">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row"
      >
        <span>© {{ formatYear() }} {{ store?.name }}</span>
        <span>قدرت‌گرفته از پلتفرم فروشگاه‌ساز</span>
      </div>
    </footer>
  </div>
</template>
