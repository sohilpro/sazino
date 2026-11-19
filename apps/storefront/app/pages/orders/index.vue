<script setup lang="ts">
import type { OrderSummaryDto, Paginated } from '@myapp/shared-types';

useSeoMeta({ title: 'سفارش‌های من', robots: 'noindex, nofollow' });

const { ready } = useRequireLogin('/orders');
const page = ref(1);

const { data, error, status } = await useAsyncData(
  'my-orders',
  () =>
    ready.value
      ? $fetch<Paginated<OrderSummaryDto>>('/api/storefront/orders', {
          query: { page: page.value, limit: 10 },
        })
      : Promise.resolve(null),
  { server: false, watch: [ready, page] },
);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-2xl font-extrabold sm:text-3xl">سفارش‌های من</h1>
      <span v-if="data?.meta.total" class="text-sm text-slate-500">{{ formatNumber(data.meta.total) }} سفارش</span>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      {{ apiErrorMessage(error) }}
    </div>

    <ul v-else-if="!data && status === 'pending'" class="space-y-3" aria-busy="true">
      <li v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
    </ul>

    <div
      v-else-if="data && !data.items.length"
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
    >
      <span class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <StoreIcon name="orders" :size="28" />
      </span>
      <p class="mb-1 font-bold text-slate-800">هنوز سفارشی ثبت نکرده‌اید</p>
      <p class="mb-5 text-sm text-slate-500">بعد از اولین خرید، سفارش‌ها و وضعیت ارسال اینجا دیده می‌شوند.</p>
      <NuxtLink to="/products" class="btn btn-primary btn-lg">شروع خرید</NuxtLink>
    </div>

    <template v-else-if="data">
      <ul class="space-y-3">
        <li v-for="o in data.items" :key="o.id">
          <NuxtLink
            :to="`/orders/${o.number}`"
            class="card flex flex-wrap items-center justify-between gap-4 !p-4 transition hover:border-brand-500"
          >
            <div class="flex min-w-0 items-center gap-4">
              <div v-if="o.thumbs.length" class="flex -space-x-3 rtl:space-x-reverse">
                <img
                  v-for="(src, i) in o.thumbs"
                  :key="i"
                  :src="src"
                  alt=""
                  class="size-14 rounded-xl border-2 border-white object-cover"
                  loading="lazy"
                />
              </div>
              <span v-else class="grid size-14 place-items-center rounded-xl bg-slate-100 text-slate-300">
                <StoreIcon name="box" :size="24" />
              </span>
              <div class="min-w-0">
                <div class="font-bold">سفارش {{ formatNumber(o.number) }}</div>
                <div class="text-xs text-slate-500">
                  {{ formatDateTime(o.createdAt) }} · {{ formatNumber(o.itemCount) }} کالا
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <span class="badge gap-1.5" :class="ORDER_STATUS_CLASS[o.status]">
                <span class="size-1.5 rounded-full" :class="ORDER_STATUS_DOT[o.status]" />
                {{ ORDER_STATUS_LABEL[o.status] }}
              </span>
              <span class="font-extrabold text-brand-700">{{ formatPrice(o.total) }}</span>
              <StoreIcon name="chevronLeft" :size="18" class="text-slate-300 max-sm:hidden" />
            </div>
          </NuxtLink>
        </li>
      </ul>

      <nav v-if="data.meta.totalPages > 1" class="flex items-center justify-center gap-3 text-sm" aria-label="صفحه‌بندی">
        <button type="button" class="btn btn-secondary" :disabled="page <= 1" @click="page--">
          <StoreIcon name="chevronRight" :size="16" />
          قبلی
        </button>
        <span class="text-slate-500">{{ formatNumber(page) }} از {{ formatNumber(data.meta.totalPages) }}</span>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="page >= data.meta.totalPages"
          @click="page++"
        >
          بعدی
          <StoreIcon name="chevronLeft" :size="16" />
        </button>
      </nav>
    </template>
  </div>
</template>
