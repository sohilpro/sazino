<script setup lang="ts">
import type { Paginated, ProductDto, StoreSettingsDto } from '@myapp/shared-types';

useHead({ title: 'داشبورد' });

const { user, tenant } = useAuth();
const api = useApi();

const { data: productCount } = useLazyAsyncData(
  'dashboard-product-count',
  async () => (await api<Paginated<ProductDto>>('/products', { query: { limit: 1 } })).meta.total,
);
const { data: settings } = useLazyAsyncData('dashboard-store-settings', () =>
  api<StoreSettingsDto>('/store-settings'),
);

const steps = computed(() => [
  { key: 'account', label: 'ساخت فروشگاه', to: '/', done: true },
  {
    key: 'look',
    label: 'انتخاب ظاهر و لوگو',
    to: '/onboarding',
    done: Boolean(
      settings.value && (settings.value.logo || settings.value.primaryColor !== DEFAULT_PRIMARY),
    ),
  },
  {
    key: 'product',
    label: 'افزودن اولین محصول',
    to: '/products/new',
    done: (productCount.value ?? 0) > 0,
  },
  { key: 'payment', label: 'اتصال درگاه پرداخت', to: '/settings/payment', done: false },
]);

const ready = computed(() => settings.value !== undefined && productCount.value !== undefined);
const doneCount = computed(() => steps.value.filter((s) => s.done).length);
const showChecklist = computed(
  () => ready.value && steps.value.slice(0, 3).some((s) => !s.done),
);
const nextStep = computed(() => steps.value.find((s) => !s.done));
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">سلام {{ user?.name }} 👋</h1>
        <p class="text-slate-600">مدیریت فروشگاه «{{ tenant?.name }}»</p>
      </div>
      <a
        v-if="settings"
        :href="settings.storeUrl"
        target="_blank"
        rel="noopener"
        class="btn btn-secondary"
      >
        مشاهده فروشگاه
        <AppIcon name="external" :size="16" />
      </a>
    </header>

    <section v-if="showChecklist" class="card overflow-hidden !p-0">
      <div class="bg-gradient-to-l from-brand-600 to-brand-800 p-6 text-white">
        <div class="mb-1 flex items-center gap-2 text-brand-100">
          <AppIcon name="sparkle" :size="18" />
          راه‌اندازی فروشگاه
        </div>
        <div class="mb-4 text-xl font-extrabold">{{ doneCount }} از {{ steps.length }} قدم انجام شده</div>
        <div class="h-2 overflow-hidden rounded-full bg-white/20">
          <div
            class="h-full rounded-full bg-white transition-all"
            :style="{ width: `${(doneCount / steps.length) * 100}%` }"
          />
        </div>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="s in steps" :key="s.key">
          <NuxtLink
            :to="s.to"
            class="flex items-center gap-3 px-6 py-3.5 text-sm transition hover:bg-slate-50"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-full border"
              :class="s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'"
            >
              <AppIcon v-if="s.done" name="check" :size="14" />
            </span>
            <span :class="s.done ? 'text-slate-400 line-through' : 'font-medium'">{{ s.label }}</span>
            <span v-if="s === nextStep" class="badge ms-auto bg-brand-50 text-brand-700">قدم بعدی</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink to="/products" class="card transition hover:border-brand-500">
        <div class="text-sm text-slate-500">محصولات</div>
        <div class="mt-1 text-3xl font-extrabold">
          {{ productCount === undefined ? '…' : formatNumber(productCount) }}
        </div>
      </NuxtLink>
      <NuxtLink to="/orders" class="card transition hover:border-brand-500">
        <div class="text-sm text-slate-500">سفارش‌ها</div>
        <div class="mt-1 text-brand-600">مشاهده‌ی سفارش‌ها ←</div>
      </NuxtLink>
      <NuxtLink
        to="/products/new"
        class="card flex items-center justify-center gap-2 text-brand-600 transition hover:border-brand-500"
      >
        <AppIcon name="plus" :size="18" />
        افزودن محصول جدید
      </NuxtLink>
    </div>

    <ApiStatus />
  </div>
</template>
