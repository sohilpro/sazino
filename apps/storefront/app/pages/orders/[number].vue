<script setup lang="ts">
import type { OrderDto, StartPaymentResponse } from '@myapp/shared-types';

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

const timeline = computed(() => (order.value ? buildOrderTimeline(order.value) : []));

const justPlaced = computed(() => route.query.placed === '1');
const paid = computed(() => route.query.paid === '1');

const cancelling = ref(false);
const cancelError = ref('');
const paying = ref(false);
const payError = ref('');

async function cancel() {
  const current = order.value;
  if (!current || !confirm('این سفارش لغو شود؟ موجودی کالاها آزاد می‌شود.')) return;

  cancelError.value = '';
  cancelling.value = true;
  try {
    order.value = await $fetch<OrderDto>(`/api/storefront/orders/${current.number}/cancel`, {
      method: 'POST',
    });
  } catch (e) {
    cancelError.value = apiErrorMessage(e, 'لغو سفارش ناموفق بود');
  } finally {
    cancelling.value = false;
  }
}

async function pay() {
  const current = order.value;
  if (!current) return;

  payError.value = '';
  paying.value = true;
  try {
    const res = await $fetch<StartPaymentResponse>(`/api/storefront/orders/${current.number}/pay`, {
      method: 'POST',
    });
    // فقط آدرس http(s) پذیرفته می‌شود
    if (!/^https?:$/.test(new URL(res.paymentUrl).protocol)) throw new Error('bad url');
    window.location.href = res.paymentUrl; // دکمه تا ترک صفحه غیرفعال می‌ماند
  } catch (e) {
    payError.value = apiErrorMessage(e, 'شروع پرداخت ناموفق بود');
    paying.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <NuxtLink
      to="/orders"
      class="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-brand-700"
    >
      <StoreIcon name="chevronRight" :size="16" />
      سفارش‌های من
    </NuxtLink>

    <p v-if="error" class="card text-center text-red-700">
      {{ statusOf(error) === 404 ? 'این سفارش پیدا نشد.' : apiErrorMessage(error) }}
    </p>
    <div v-else-if="!order && status === 'pending'" class="space-y-4" aria-busy="true">
      <div class="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
      <div class="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
    <p v-else-if="!order && ready" class="card text-center text-slate-500">این سفارش پیدا نشد.</p>

    <template v-else-if="order">
      <div
        v-if="justPlaced"
        class="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"
        role="status"
      >
        <StoreIcon name="check" :size="20" class="mt-0.5 shrink-0" />
        <p>سفارش شما ثبت شد و موجودی کالاها برایتان نگه داشته شده است.</p>
      </div>
      <div
        v-if="paid && order.status === 'PAID'"
        class="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"
        role="status"
      >
        <StoreIcon name="check" :size="20" class="mt-0.5 shrink-0" />
        <p>پرداخت شما با موفقیت انجام شد. از خرید شما سپاسگزاریم.</p>
      </div>

      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold sm:text-3xl">سفارش {{ formatNumber(order.number) }}</h1>
          <p class="text-sm text-slate-500">ثبت‌شده در {{ formatDateTime(order.createdAt) }}</p>
        </div>
        <span class="badge gap-1.5 !px-3 !py-1.5 text-sm" :class="ORDER_STATUS_CLASS[order.status]">
          <span class="size-2 rounded-full" :class="ORDER_STATUS_DOT[order.status]" />
          {{ ORDER_STATUS_LABEL[order.status] }}
        </span>
      </header>

      <!-- خط زمانی -->
      <ol class="card flex items-start !p-5" aria-label="مراحل سفارش">
        <li v-for="(step, i) in timeline" :key="step.key" class="flex flex-1 items-start gap-3 last:flex-none">
          <div class="flex flex-col items-center gap-1.5 text-center">
            <span
              class="grid size-8 place-items-center rounded-full text-sm font-bold"
              :class="{
                'bg-emerald-500 text-white': step.state === 'done',
                'bg-brand-600 text-on-brand ring-4 ring-brand-100': step.state === 'current',
                'bg-slate-200 text-slate-500': step.state === 'todo',
                'bg-red-500 text-white': step.state === 'canceled',
              }"
            >
              <StoreIcon v-if="step.state === 'done'" name="check" :size="16" />
              <StoreIcon v-else-if="step.state === 'canceled'" name="close" :size="16" />
              <template v-else>{{ formatNumber(i + 1) }}</template>
            </span>
            <span class="text-xs font-bold" :class="step.state === 'todo' ? 'text-slate-400' : 'text-slate-800'">
              {{ step.label }}
            </span>
            <span v-if="step.at" class="max-w-28 text-[11px] leading-4 text-slate-500">
              {{ formatDateTime(step.at) }}
            </span>
          </div>
          <span
            v-if="i < timeline.length - 1"
            class="mt-4 h-0.5 flex-1 rounded"
            :class="step.state === 'done' ? 'bg-emerald-300' : 'bg-slate-200'"
          />
        </li>
      </ol>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <section v-if="order.status === 'PENDING'" class="card space-y-3 !border-brand-200 !bg-brand-50/50">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <StoreIcon name="clock" :size="20" class="text-brand-600" />
              در انتظار پرداخت
            </h2>
            <p v-if="order.expiresAt" class="text-sm text-amber-800">
              مهلت پرداخت تا {{ formatDateTime(order.expiresAt) }}؛ پس از آن سفارش لغو می‌شود.
            </p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary btn-lg" :disabled="paying" @click="pay">
                {{ paying ? 'در حال انتقال به درگاه…' : 'پرداخت آنلاین' }}
              </button>
              <button type="button" class="btn btn-secondary btn-lg" :disabled="cancelling || paying" @click="cancel">
                لغو سفارش
              </button>
            </div>
            <p v-if="payError" class="text-sm text-red-700" role="alert">{{ payError }}</p>
            <p v-if="cancelError" class="text-sm text-red-700" role="alert">{{ cancelError }}</p>
          </section>

          <p v-if="order.status === 'CANCELED'" class="card text-sm text-slate-600">
            {{ CANCEL_REASON_LABEL[order.cancelReason ?? ''] ?? 'این سفارش لغو شده است.' }}
          </p>

          <section class="card space-y-3">
            <h2 class="text-lg font-bold">کالاها</h2>
            <ul class="divide-y divide-slate-100">
              <li
                v-for="item in order.items"
                :key="item.productId + item.variantTitle"
                class="flex items-center gap-4 py-3 first:pt-0"
              >
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  alt=""
                  class="size-16 shrink-0 rounded-xl border border-slate-100 object-cover"
                />
                <span v-else class="grid size-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300">
                  <StoreIcon name="box" :size="24" />
                </span>
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
        </div>

        <aside class="space-y-6">
          <section class="card space-y-2 text-sm leading-7">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <StoreIcon name="mapPin" :size="20" class="text-brand-600" />
              نشانی تحویل
            </h2>
            <div>
              <b>{{ order.address.recipientName }}</b> · <span dir="ltr">{{ order.address.recipientPhone }}</span>
            </div>
            <div>{{ order.address.province }}، {{ order.address.city }}، {{ order.address.address }}</div>
            <div>کد پستی: <span dir="ltr">{{ order.address.postalCode }}</span></div>
            <div v-if="order.note" class="rounded-lg bg-amber-50 p-3 text-amber-900">
              <div class="text-xs font-bold">توضیحات شما</div>
              {{ order.note }}
            </div>
          </section>

          <section v-if="order.status === 'SHIPPED' && order.trackingCode" class="card space-y-1 text-sm">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <StoreIcon name="truck" :size="20" class="text-brand-600" />
              ارسال
            </h2>
            <div>
              کد رهگیری مرسوله: <b dir="ltr">{{ order.trackingCode }}</b>
            </div>
          </section>

          <section v-if="order.payment" class="card space-y-1 text-sm">
            <h2 class="text-lg font-bold">پرداخت</h2>
            <div>
              کد پیگیری پرداخت: <b dir="ltr">{{ order.payment.refId }}</b>
            </div>
            <div v-if="order.payment.cardPan" class="text-slate-600">
              کارت <span dir="ltr">{{ order.payment.cardPan }}</span>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
