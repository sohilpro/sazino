<script setup lang="ts">
const { user, tenant, logout } = useAuth();
const config = useRuntimeConfig();

const links = [
  { to: '/', label: 'داشبورد', exact: true },
  { to: '/orders', label: 'سفارش‌ها', exact: false },
  { to: '/products', label: 'محصولات', exact: false },
  { to: '/categories', label: 'دسته‌بندی‌ها', exact: false },
  { to: '/pages', label: 'صفحات', exact: false },
  { to: '/settings/theme', label: 'ظاهر فروشگاه', exact: false },
  { to: '/settings/payment', label: 'درگاه پرداخت', exact: false },
  { to: '/settings/domains', label: 'دامنه‌ی اختصاصی', exact: false },
  { to: '/settings/plan', label: 'پلن و مصرف', exact: false },
];

const activeClass = 'bg-brand-50 font-semibold text-brand-700';
const loggingOut = ref(false);

async function onLogout() {
  loggingOut.value = true;
  try {
    await logout();
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen md:flex">
    <aside
      class="border-b border-slate-200 bg-white p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-e"
    >
      <div class="text-lg font-extrabold text-brand-600">{{ tenant?.name }}</div>
      <div class="mb-6 text-xs text-slate-500" dir="ltr">
        {{ tenant?.subdomain }}.{{ config.public.platformDomain }}
      </div>

      <nav class="flex gap-1 overflow-x-auto md:flex-col">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
          :active-class="link.exact ? '' : activeClass"
          :exact-active-class="activeClass"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="mt-6 border-t border-slate-200 pt-4 text-sm">
        <div class="font-medium">{{ user?.name }}</div>
        <div class="mb-3 text-xs text-slate-500">{{ user ? ROLE_LABEL[user.role] : '' }}</div>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="loggingOut"
          @click="onLogout"
        >
          خروج
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>
