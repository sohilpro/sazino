<script setup lang="ts">
import type { OrderDto } from '@myapp/shared-types';

useSeoMeta({ title: 'جزئیات سفارش', robots: 'noindex, nofollow' });

const route = useRoute();
const number = computed(() => String(route.params.number));
const { ready } = useRequireLogin(`/orders/${number.value}`);

const { data: order, error, status } = await useAsyncData(
  () => `order-${number.value}`,
  () =>
    ready.value && /^\d{1,10}$/.test(number.value)
      ? $fetch<OrderDto>(`/api/storefront/orders/${number.value}`)
      : Promise.resolve(null),
  { server: false, watch: [ready] },
);

const justPlaced = computed(() => route.query.placed === '1');
const cancelling = ref(false);
const cancelError = ref('');

async function cancel() {
  if (!order.value || !confirm('این سفارش لغو شود؟ موجودی کالاها آزاد می‌شود.')) return;
  cancelError.value = '';
  cancelling.value = true;
  try {
    order.value = await $fetch<OrderDto>(`/api/storefront/orders/${order.value.number}/cancel`, {
      method: 'POST',
    });
  } catch (e) {
    cancelError.value = apiErrorMessage(e, 'لغو سفارش ناموفق بود');
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <NuxtLink to="/orders" class="text-sm text-slate-500 hover:text-brand-700">→ سفارش‌های من</NuxtLink>

    <p v-if="error" class="card text-center text-red-700">
      {{ statusOf(error) === 404 ? 'این سفارش پیدا نشد.' : apiErrorMessage(error) }}
    </p>
    <p v-else-if="!order && status === 'pending'" class="card text-center text-slate-500">در حال بارگذاری…</p>
    <p v-else-if="!order && ready" class="card text-center text-slate-500">این سفارش پیدا نشد.</p>

    <template v-else-if="order">
      <p v-if="justPlaced" class="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
        سفارش شما ثبت شد و موجودی کالاها برایتان نگه داشته شده است.
      </p>

      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold">سفارش {{ formatNumber(order.number) }}</h1>
          <p class="text-sm text-slate-500">ثبت‌شده در {{ formatDateTime(order.createdAt) }}</p>
        </div>
        <span class="badge" :class="ORDER_STATUS_CLASS[order.status]">{{ ORDER_STATUS_LABEL[order.status] }}</span>
      </header>

      <section v-if="order.status === 'PENDING'" class="card space-y-3">
        <p v-if="order.expiresAt" class="text-sm text-amber-700">
          مهلت پرداخت تا {{ formatDateTime(order.expiresAt) }}؛ پس از آن سفارش لغو می‌شود.
        </p>
        <div class="flex flex-wrap gap-2">
          <!-- دکمه‌ی پرداخت آنلاین در روز ۱۲ اینجا وصل می‌شود -->
          <button type="button" class="btn btn-primary" disabled>پرداخت آنلاین (به‌زودی)</button>
          <button type="button" class="btn btn-secondary" :disabled="cancelling" @click="cancel">
            لغو سفارش
          </button>
        </div>
        <p v-if="cancelError" class="text-sm text-red-700" role="alert">{{ cancelError }}</p>
      </section>

      <p v-if="order.status === 'CANCELED'" class="card text-sm text-slate-600">
        {{ CANCEL_REASON_LABEL[order.cancelReason ?? ''] ?? 'این سفارش لغو شده است.' }}
      </p>
      <p v-if="order.status === 'SHIPPED' && order.trackingCode" class="card text-sm">
        کد رهگیری مرسوله: <b dir="ltr">{{ order.trackingCode }}</b>
      </p>

      <section class="card space-y-3">
        <h2 class="text-lg font-bold">کالاها</h2>
        <ul class="divide-y divide-slate-100">
          <li v-for="item in order.items" :key="item.productId + item.variantTitle" class="flex items-center gap-4 py-3">
            <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="size-14 rounded-lg object-cover" />
            <div v-else class="size-14 rounded-lg bg-slate-100" />
            <div class="min-w-0 flex-1 text-sm">
              <div class="truncate font-medium">{{ item.productTitle }}</div>
              <div v-if="item.variantTitle !== 'پیش‌فرض'" class="text-xs text-slate-500">{{ item.variantTitle }}</div>
              <div class="text-xs text-slate-500">
                {{ formatNumber(item.quantity) }} × {{ formatPrice(item.unitPrice) }}
              </div>
            </div>
            <div class="shrink-0 font-medium">{{ formatPrice(item.lineTotal) }}</div>
          </li>
        </ul>

        <dl class="space-y-2 border-t border-slate-100 pt-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-600">جمع کالاها</dt>
            <dd>{{ formatPrice(order.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-600">ارسال ({{ order.shippingTitle }})</dt>
            <dd>{{ order.shippingFee ? formatPrice(order.shippingFee) : 'رایگان' }}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-100 pt-3 text-base font-extrabold">
            <dt>مبلغ کل</dt>
            <dd class="text-brand-700">{{ formatPrice(order.total) }}</dd>
          </div>
        </dl>
      </section>

      <section class="card space-y-1 text-sm leading-7">
        <h2 class="mb-2 text-lg font-bold">نشانی تحویل</h2>
        <div>
          <b>{{ order.address.recipientName }}</b> · <span dir="ltr">{{ order.address.recipientPhone }}</span>
        </div>
        <div>{{ order.address.province }}، {{ order.address.city }}، {{ order.address.address }}</div>
        <div>کد پستی: <span dir="ltr">{{ order.address.postalCode }}</span></div>
        <div v-if="order.note" class="border-t border-slate-100 pt-2 text-slate-600">
          توضیحات: {{ order.note }}
        </div>
      </section>
    </template>
  </div>
</template>