<script setup lang="ts">
import type { IconName } from '~/components/AppIcon.vue';

interface NavLink {
  to: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

const { user, tenant, logout } = useAuth();
const config = useRuntimeConfig();
const route = useRoute();

const groups: { title: string; links: NavLink[] }[] = [
  {
    title: 'فروش',
    links: [
      { to: '/', label: 'داشبورد', icon: 'home', exact: true },
      { to: '/orders', label: 'سفارش‌ها', icon: 'orders' },
      { to: '/products', label: 'محصولات', icon: 'products' },
      { to: '/categories', label: 'دسته‌بندی‌ها', icon: 'categories' },
    ],
  },
  {
    title: 'فروشگاه',
    links: [
      { to: '/pages', label: 'صفحات', icon: 'pages' },
      { to: '/settings/theme', label: 'ظاهر فروشگاه', icon: 'theme' },
    ],
  },
  {
    title: 'تنظیمات',
    links: [
      { to: '/settings/payment', label: 'درگاه پرداخت', icon: 'payment' },
      { to: '/settings/domains', label: 'دامنه‌ی اختصاصی', icon: 'domain' },
      { to: '/settings/plan', label: 'پلن و مصرف', icon: 'plan' },
    ],
  },
];

const open = ref(false);
const loggingOut = ref(false);
const initial = computed(() => [...(tenant.value?.name?.trim() || '?')][0]);

const isActive = (l: NavLink) =>
  l.exact ? route.path === l.to : route.path === l.to || route.path.startsWith(`${l.to}/`);

watch(
  () => route.fullPath,
  () => (open.value = false),
);

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
  <div class="min-h-screen lg:flex">
    <!-- نوار بالای موبایل -->
    <header
      class="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden"
    >
      <div class="flex items-center gap-2 font-extrabold text-brand-700">
        <span class="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">{{ initial }}</span>
        {{ tenant?.name }}
      </div>
      <button type="button" class="btn btn-ghost px-2" aria-label="منو" @click="open = !open">
        <AppIcon :name="open ? 'close' : 'menu'" />
      </button>
    </header>

    <div v-if="open" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" @click="open = false" />

    <aside
      class="fixed inset-y-0 start-0 z-40 flex w-72 flex-col border-e border-slate-200 bg-white p-4 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0"
      :class="open ? 'translate-x-0' : 'max-lg:translate-x-full max-lg:rtl:translate-x-full max-lg:ltr:-translate-x-full'"
    >
      <div class="mb-6 flex items-center gap-3 px-1">
        <span class="grid size-10 place-items-center rounded-xl bg-brand-600 text-lg font-extrabold text-white">
          {{ initial }}
        </span>
        <div class="min-w-0">
          <div class="truncate font-extrabold">{{ tenant?.name }}</div>
          <div class="tech truncate text-xs text-slate-500">
            {{ tenant?.subdomain }}.{{ config.public.platformDomain }}
          </div>
        </div>
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto">
        <div v-for="g in groups" :key="g.title">
          <div class="mb-1 px-3 text-xs font-medium text-slate-400">{{ g.title }}</div>
          <NuxtLink
            v-for="l in g.links"
            :key="l.to"
            :to="l.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
            :class="
              isActive(l)
                ? 'bg-brand-50 font-semibold text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            "
          >
            <AppIcon :name="l.icon" :size="18" />
            {{ l.label }}
          </NuxtLink>
        </div>
      </nav>

      <div class="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div class="min-w-0 text-sm">
          <div class="truncate font-medium">{{ user?.name }}</div>
          <div class="text-xs text-slate-500">{{ user ? ROLE_LABEL[user.role] : '' }}</div>
        </div>
        <button
          type="button"
          class="btn btn-ghost px-2"
          title="خروج"
          aria-label="خروج"
          :disabled="loggingOut"
          @click="onLogout"
        >
          <AppIcon name="logout" :size="18" />
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <div class="mx-auto max-w-6xl"><slot /></div>
    </main>
  </div>
</template>
