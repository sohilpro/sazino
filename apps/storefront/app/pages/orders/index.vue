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
    <h1 class="text-2xl font-extrabold">سفارش‌های من</h1>

    <p v-if="error" class="card text-center text-red-700">{{ apiErrorMessage(error) }}</p>
    <p v-else-if="!data && status === 'pending'" class="card text-center text-slate-500">در حال بارگذاری…</p>

    <div v-else-if="data && !data.items.length" class="card text-center">
      <p class="mb-4 text-slate-500">هنوز سفارشی ثبت نکرده‌اید.</p>
      <NuxtLink to="/products" class="btn btn-primary">شروع خرید</NuxtLink>
    </div>

    <template v-else-if="data">
      <NuxtLink
        v-for="o in data.items"
        :key="o.id"
        :to="`/orders/${o.number}`"
        class="card flex flex-wrap items-center justify-between gap-4 transition hover:border-brand-500"
      >
        <div class="flex items-center gap-4">
          <div class="flex -space-x-3 rtl:space-x-reverse">
            <img
              v-for="(src, i) in o.thumbs"
              :key="i"
              :src="src"
              alt=""
              class="size-12 rounded-lg border-2 border-white object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <div class="font-bold">سفارش {{ formatNumber(o.number) }}</div>
            <div class="text-xs text-slate-500">
              {{ formatDateTime(o.createdAt) }} · {{ formatNumber(o.itemCount) }} کالا
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="badge" :class="ORDER_STATUS_CLASS[o.status]">{{ ORDER_STATUS_LABEL[o.status] }}</span>
          <span class="font-bold text-brand-700">{{ formatPrice(o.total) }}</span>
        </div>
      </NuxtLink>

      <div v-if="data.meta.totalPages > 1" class="flex items-center justify-center gap-3 text-sm">
        <button type="button" class="btn btn-secondary" :disabled="page <= 1" @click="page--">قبلی</button>
        <span>{{ formatNumber(page) }} از {{ formatNumber(data.meta.totalPages) }}</span>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="page >= data.meta.totalPages"
          @click="page++"
        >
          بعدی
        </button>
      </div>
    </template>
  </div>
</template>