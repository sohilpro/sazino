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
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold">سفارش‌ها</h1>
      <button type="button" class="btn btn-secondary btn-sm" @click="() => refresh()">بروزرسانی</button>
    </header>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm transition"
        :class="!filters.status ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-500'"
        @click="setQuery({ status: undefined, page: undefined })"
      >
        همه <span v-if="totalCount !== null">({{ formatNumber(totalCount) }})</span>
      </button>
      <button
        v-for="s in ORDER_STATUSES"
        :key="s"
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm transition"
        :class="filters.status === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-500'"
        @click="setQuery({ status: s, page: undefined })"
      >
        {{ ORDER_STATUS_LABEL[s] }} <span v-if="stats">({{ formatNumber(stats[s]) }})</span>
      </button>
    </div>

    <label class="block max-w-md">
      <span class="label">جستجو</span>
      <input v-model="search" class="input" placeholder="شماره‌ی سفارش، نام گیرنده یا موبایل" />
    </label>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">{{ apiErrorMessage(error) }}</p>
      <button type="button" class="btn btn-secondary" @click="() => refresh()">تلاش مجدد</button>
    </div>

    <template v-else-if="data">
      <p
        v-if="!data.items.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"
      >
        سفارشی پیدا نشد.
      </p>

      <div
        v-else
        class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm transition"
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 text-start font-medium">سفارش</th>
              <th class="px-4 py-3 text-start font-medium">تاریخ</th>
              <th class="px-4 py-3 text-start font-medium">گیرنده</th>
              <th class="px-4 py-3 text-start font-medium">وضعیت</th>
              <th class="px-4 py-3 text-start font-medium">مبلغ</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="o in data.items" :key="o.id" class="hover:bg-slate-50">
              <td class="px-4 py-3 font-bold">
                <NuxtLink :to="`/orders/${o.number}`" class="hover:text-brand-600">{{ formatNumber(o.number) }}</NuxtLink>
                <div class="text-xs font-normal text-slate-400">{{ formatNumber(o.itemCount) }} کالا</div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatDateTime(o.createdAt) }}</td>
              <td class="px-4 py-3">
                {{ o.recipientName }}
                <div class="text-xs text-slate-400" dir="ltr">{{ o.customerPhone }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="badge" :class="ORDER_STATUS_CLASS[o.status]">{{ ORDER_STATUS_LABEL[o.status] }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-medium">{{ formatPrice(o.total) }}</td>
              <td class="px-4 py-3 text-end">
                <NuxtLink :to="`/orders/${o.number}`" class="btn btn-secondary btn-sm">مشاهده</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination :meta="data.meta" @change="(n) => setQuery({ page: n === 1 ? undefined : n })" />
    </template>
  </div>
</template>