<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router';
import type {
  OrderStatus,
  Paginated,
  SellerOrderStats,
  SellerOrderSummaryDto,
} from '@myapp/shared-types';

useHead({ title: 'سفارش‌ها' });

const api = useApi();
const route = useRoute();
const router = useRouter();

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const filters = computed(() => {
  const page = Math.floor(Number(route.query.page));
  const status = str(route.query.status);
  return {
    page: page > 0 && page <= 100_000 ? page : 1,
    q: str(route.query.q).trim().slice(0, 100),
    status: (ORDER_STATUSES as string[]).includes(status) ? (status as OrderStatus) : '',
  };
});

const { data, error, status, refresh } = await useAsyncData(
  'orders',
  () =>
    api<Paginated<SellerOrderSummaryDto>>('/orders', {
      query: { page: filters.value.page, limit: 20, q: filters.value.q, status: filters.value.status },
    }),
  { watch: [filters] },
);

const { data: stats } = await useAsyncData('order-stats', () => api<SellerOrderStats>('/orders/stats'), {
  watch: [filters],
});

const totalCount = computed(() =>
  stats.value ? ORDER_STATUSES.reduce((sum, s) => sum + stats.value![s], 0) : null,
);

function setQuery(patch: Record<string, string | number | undefined>) {
  const next = { ...route.query, ...patch } as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    if (next[key] === undefined || next[key] === '') delete next[key];
  }
  void router.replace({ query: next as LocationQueryRaw });
}

const search = ref(filters.value.q);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => setQuery({ q: value.trim() || undefined, page: undefined }), 350);
});
onBeforeUnmount(() => clearTimeout(timer));

const hasFilters = computed(() => Boolean(filters.value.q || filters.value.status));
const neverHadOrders = computed(() => totalCount.value === 0);

function clearFilters() {
  search.value = '';
  void router.replace({ query: {} });
}

</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="سفارش‌ها"
      :subtitle="totalCount !== null ? `${formatNumber(totalCount)} سفارش` : undefined"
    >
      <button type="button" class="btn btn-secondary" :disabled="status === 'pending'" @click="() => refresh()">
        <AppIcon name="refresh" :size="16" :class="status === 'pending' ? 'animate-spin' : ''" />
        بروزرسانی
      </button>
    </PageHeader>

    <!-- کارت‌های وضعیت (هم آمار، هم فیلتر) -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <button
        type="button"
        class="card text-start !p-4 transition"
        :class="!filters.status ? 'border-brand-600 ring-2 ring-brand-600/20' : 'hover:border-slate-300'"
        :aria-pressed="!filters.status"
        @click="setQuery({ status: undefined, page: undefined })"
      >
        <div class="text-sm text-slate-500">همه‌ی سفارش‌ها</div>
        <div class="mt-1 text-2xl font-extrabold">{{ totalCount === null ? '…' : formatNumber(totalCount) }}</div>
      </button>
      <button
        v-for="s in ORDER_STATUSES"
        :key="s"
        type="button"
        class="card text-start !p-4 transition"
        :class="filters.status === s ? 'border-brand-600 ring-2 ring-brand-600/20' : 'hover:border-slate-300'"
        :aria-pressed="filters.status === s"
        @click="setQuery({ status: s, page: undefined })"
      >
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="size-2 rounded-full" :class="ORDER_STATUS_DOT[s]" />
          {{ ORDER_STATUS_LABEL[s] }}
        </div>
        <div class="mt-1 text-2xl font-extrabold">{{ stats ? formatNumber(stats[s]) : '…' }}</div>
      </button>
    </div>

    <div class="card flex flex-wrap items-center gap-3 !p-3">
      <div class="min-w-56 flex-1">
        <SearchInput v-model="search" placeholder="شماره‌ی سفارش، نام گیرنده یا موبایل" />
      </div>
      <button v-if="hasFilters" type="button" class="btn btn-ghost btn-sm" @click="clearFilters">
        <AppIcon name="close" :size="14" />
        پاک کردن فیلترها
      </button>
    </div>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">{{ apiErrorMessage(error) }}</p>
      <button type="button" class="btn btn-secondary" @click="() => refresh()">تلاش مجدد</button>
    </div>

    <template v-else-if="data">
      <EmptyState
        v-if="!data.items.length && hasFilters"
        icon="search"
        title="سفارشی با این فیلترها پیدا نشد"
        description="وضعیت یا عبارت جستجو را تغییر دهید."
      >
        <button type="button" class="btn btn-secondary" @click="clearFilters">پاک کردن فیلترها</button>
      </EmptyState>

      <EmptyState
        v-else-if="!data.items.length"
        icon="orders"
        title="هنوز سفارشی ثبت نشده"
        :description="
          neverHadOrders
            ? 'وقتی مشتری‌ها از فروشگاه شما خرید کنند، سفارش‌ها اینجا نمایش داده می‌شوند. مطمئن شوید محصول فعال و درگاه پرداخت تنظیم است.'
            : undefined
        "
      >
        <NuxtLink to="/products" class="btn btn-secondary">مدیریت محصولات</NuxtLink>
        <NuxtLink to="/settings/payment" class="btn btn-secondary">درگاه پرداخت</NuxtLink>
      </EmptyState>

      <template v-else>
        <div :class="status === 'pending' ? 'pointer-events-none opacity-60 transition' : 'transition'">
          <!-- جدول (دسکتاپ) -->
          <div class="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
            <table class="w-full text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-4 py-3 text-start font-medium">سفارش</th>
                  <th class="px-4 py-3 text-start font-medium">تاریخ</th>
                  <th class="px-4 py-3 text-start font-medium">گیرنده</th>
                  <th class="px-4 py-3 text-start font-medium">وضعیت</th>
                  <th class="px-4 py-3 text-start font-medium">مبلغ</th>
                  <th class="w-20 px-4 py-3"><span class="sr-only">عملیات</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="o in data.items" :key="o.id" class="transition hover:bg-slate-50">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${o.number}`" class="font-bold hover:text-brand-600">
                      #{{ formatNumber(o.number) }}
                    </NuxtLink>
                    <div class="text-xs text-slate-400">{{ formatNumber(o.itemCount) }} کالا</div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatDateTime(o.createdAt) }}</td>
                  <td class="px-4 py-3">
                    {{ o.recipientName }}
                    <div class="tech text-xs text-slate-400">{{ o.customerPhone }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="badge gap-1.5" :class="ORDER_STATUS_CLASS[o.status]">
                      <span class="size-1.5 rounded-full" :class="ORDER_STATUS_DOT[o.status]" />
                      {{ ORDER_STATUS_LABEL[o.status] }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-medium">{{ formatPrice(o.total) }}</td>
                  <td class="px-4 py-3 text-end">
                    <NuxtLink :to="`/orders/${o.number}`" class="btn btn-secondary btn-sm">مشاهده</NuxtLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- کارت (موبایل) -->
          <ul class="space-y-3 md:hidden">
            <li v-for="o in data.items" :key="o.id">
              <NuxtLink :to="`/orders/${o.number}`" class="card block !p-4 transition hover:border-brand-500">
                <div class="flex items-center justify-between">
                  <span class="font-bold">#{{ formatNumber(o.number) }}</span>
                  <span class="badge gap-1.5" :class="ORDER_STATUS_CLASS[o.status]">
                    <span class="size-1.5 rounded-full" :class="ORDER_STATUS_DOT[o.status]" />
                    {{ ORDER_STATUS_LABEL[o.status] }}
                  </span>
                </div>
                <div class="mt-2 text-sm">{{ o.recipientName }}</div>
                <div class="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{{ formatDateTime(o.createdAt) }} · {{ formatNumber(o.itemCount) }} کالا</span>
                  <span class="text-sm font-medium text-slate-800">{{ formatPrice(o.total) }}</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <AppPagination :meta="data.meta" @change="(n) => setQuery({ page: n === 1 ? undefined : n })" />
      </template>
    </template>
  </div>
</template>
