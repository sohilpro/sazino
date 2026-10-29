<script setup lang="ts">
import type { SellerOrderDto } from '@myapp/shared-types';

const route = useRoute();
const api = useApi();
const toast = useToast();
const { user } = useAuth();

const number = String(route.params.number);
useHead({ title: () => `سفارش ${number}` });

const { data: order, error } = await useAsyncData(`order-${number}`, () =>
  api<SellerOrderDto>(`/orders/${number}`),
);

const canManage = computed(() => user.value?.role === 'OWNER' || user.value?.role === 'ADMIN');
const busy = ref(false);
const tracking = ref('');
const reference = ref('');

async function act(path: string, body: Record<string, unknown>, successMessage: string) {
  busy.value = true;
  try {
    order.value = await api<SellerOrderDto>(`/orders/${number}/${path}`, { method: 'POST', body });
    toast.success(successMessage);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    busy.value = false;
  }
}

function ship() {
  const code = tracking.value.trim();
  if (code && !/^[A-Za-z0-9۰-۹][A-Za-z0-9۰-۹\-_ ]{2,63}$/.test(code)) {
    toast.error('کد رهگیری فقط حروف انگلیسی، عدد و خط تیره (۳ تا ۶۴ کاراکتر) دارد');
    return;
  }
  void act('ship', code ? { trackingCode: code } : {}, 'سفارش به‌عنوان ارسال‌شده ثبت شد');
}

function markPaid() {
  if (!confirm('پرداخت این سفارش (خارج از درگاه) تأیید شود؟ این کار قابل بازگشت نیست.')) return;
  const ref = reference.value.trim();
  void act('mark-paid', ref ? { reference: ref } : {}, 'پرداخت سفارش ثبت شد');
}

function cancel() {
  const paidNote =
    order.value?.status === 'PAID'
      ? '\nاین سفارش پرداخت شده است؛ بازگرداندن وجه به مشتری را باید خودتان انجام دهید.'
      : '';
  if (!confirm(`این سفارش لغو شود؟ موجودی کالاها آزاد می‌شود.${paidNote}`)) return;
  void act('cancel', {}, 'سفارش لغو شد');
}

const PROVIDER_LABEL = { ZARINPAL: 'زرین‌پال', MANUAL: 'ثبت دستی' } as const;
const PAYMENT_STATUS_LABEL = { INITIATED: 'در جریان', PAID: 'موفق', FAILED: 'ناموفق' } as const;
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <NuxtLink to="/orders" class="text-sm text-slate-500 hover:text-brand-600">→ سفارش‌ها</NuxtLink>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">
        {{ statusOf(error) === 404 ? 'این سفارش پیدا نشد.' : apiErrorMessage(error) }}
      </p>
      <NuxtLink to="/orders" class="btn btn-secondary">بازگشت به لیست</NuxtLink>
    </div>

    <template v-else-if="order">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold">سفارش {{ formatNumber(order.number) }}</h1>
          <p class="text-sm text-slate-500">ثبت‌شده در {{ formatDateTime(order.createdAt) }}</p>
        </div>
        <span class="badge" :class="ORDER_STATUS_CLASS[order.status]">{{ ORDER_STATUS_LABEL[order.status] }}</span>
      </header>

      <!-- اقدامات -->
      <section class="card space-y-4">
        <h2 class="text-lg font-bold">اقدامات</h2>

        <template v-if="order.status === 'PENDING'">
          <p class="text-sm text-slate-600">
            این سفارش هنوز پرداخت نشده است
            <span v-if="order.expiresAt">(مهلت تا {{ formatDateTime(order.expiresAt) }})</span>.
          </p>
          <div v-if="canManage" class="flex flex-wrap items-end gap-2">
            <label class="min-w-56 flex-1">
              <span class="label">شماره‌ی پیگیری یا توضیح (اختیاری)</span>
              <input v-model="reference" class="input" maxlength="100" placeholder="مثلاً: کارت‌به‌کارت — ۴۵۶۷" />
            </label>
            <button type="button" class="btn btn-primary" :disabled="busy" @click="markPaid">ثبت پرداخت دستی</button>
            <button type="button" class="btn btn-secondary text-red-600" :disabled="busy" @click="cancel">لغو سفارش</button>
          </div>
          <p v-else class="text-sm text-slate-500">فقط مالک و مدیر می‌توانند پرداخت را ثبت یا سفارش را لغو کنند.</p>
        </template>

        <template v-else-if="order.status === 'PAID'">
          <div class="flex flex-wrap items-end gap-2">
            <label class="min-w-56 flex-1">
              <span class="label">کد رهگیری مرسوله (اختیاری)</span>
              <input v-model="tracking" class="input" dir="ltr" maxlength="64" />
            </label>
            <button type="button" class="btn btn-primary" :disabled="busy" @click="ship">ثبت ارسال</button>
            <button v-if="canManage" type="button" class="btn btn-secondary text-red-600" :disabled="busy" @click="cancel">
              لغو سفارش
            </button>
          </div>
          <p class="text-xs text-slate-500">با ثبت ارسال، پیامک اطلاع‌رسانی برای مشتری فرستاده می‌شود (اگر پترن آن تنظیم شده باشد).</p>
        </template>

        <p v-else-if="order.status === 'SHIPPED'" class="text-sm">
          ارسال شده در {{ order.shippedAt ? formatDateTime(order.shippedAt) : '' }}
          <template v-if="order.trackingCode">· کد رهگیری: <b dir="ltr">{{ order.trackingCode }}</b></template>
        </p>

        <p v-else class="text-sm text-slate-600">
          {{ CANCEL_REASON_LABEL[order.cancelReason ?? ''] ?? 'این سفارش لغو شده است.' }}
        </p>
      </section>

      <!-- کالاها -->
      <section class="card space-y-3">
        <h2 class="text-lg font-bold">کالاها</h2>
        <ul class="divide-y divide-slate-100">
          <li v-for="item in order.items" :key="item.productId + item.variantTitle" class="flex items-center gap-4 py-3">
            <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="size-14 rounded-lg object-cover" />
            <div v-else class="size-14 rounded-lg bg-slate-100" />
            <div class="min-w-0 flex-1 text-sm">
              <div class="truncate font-medium">{{ item.productTitle }}</div>
              <div v-if="item.variantTitle !== 'پیش‌فرض'" class="text-xs text-slate-500">{{ item.variantTitle }}</div>
              <div class="text-xs text-slate-500">{{ formatNumber(item.quantity) }} × {{ formatPrice(item.unitPrice) }}</div>
            </div>
            <div class="shrink-0 font-medium">{{ formatPrice(item.lineTotal) }}</div>
          </li>
        </ul>
        <dl class="space-y-2 border-t border-slate-100 pt-3 text-sm">
          <div class="flex justify-between"><dt class="text-slate-600">جمع کالاها</dt><dd>{{ formatPrice(order.subtotal) }}</dd></div>
          <div class="flex justify-between">
            <dt class="text-slate-600">ارسال ({{ order.shippingTitle }})</dt>
            <dd>{{ order.shippingFee ? formatPrice(order.shippingFee) : 'رایگان' }}</dd>
          </div>
          <div class="flex justify-between border-t border-slate-100 pt-3 text-base font-extrabold">
            <dt>مبلغ کل</dt><dd class="text-brand-600">{{ formatPrice(order.total) }}</dd>
          </div>
        </dl>
      </section>

      <div class="grid gap-6 md:grid-cols-2">
        <section class="card space-y-1 text-sm leading-7">
          <h2 class="mb-2 text-lg font-bold">نشانی تحویل</h2>
          <div><b>{{ order.address.recipientName }}</b> · <span dir="ltr">{{ order.address.recipientPhone }}</span></div>
          <div>{{ order.address.province }}، {{ order.address.city }}، {{ order.address.address }}</div>
          <div>کد پستی: <span dir="ltr">{{ order.address.postalCode }}</span></div>
          <div v-if="order.note" class="border-t border-slate-100 pt-2 text-slate-600">توضیحات مشتری: {{ order.note }}</div>
        </section>

        <section class="card space-y-1 text-sm leading-7">
          <h2 class="mb-2 text-lg font-bold">مشتری</h2>
          <div>{{ order.customer.name || 'بدون نام' }}</div>
          <div dir="ltr" class="text-end">{{ order.customer.phone }}</div>
        </section>
      </div>

      <section class="card space-y-3">
        <h2 class="text-lg font-bold">پرداخت‌ها</h2>
        <p v-if="!order.payments.length" class="text-sm text-slate-500">هنوز تلاشی برای پرداخت ثبت نشده است.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-slate-500">
              <tr>
                <th class="px-2 py-2 text-start font-medium">روش</th>
                <th class="px-2 py-2 text-start font-medium">وضعیت</th>
                <th class="px-2 py-2 text-start font-medium">مبلغ</th>
                <th class="px-2 py-2 text-start font-medium">کد پیگیری</th>
                <th class="px-2 py-2 text-start font-medium">زمان</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="p in order.payments" :key="p.id">
                <td class="px-2 py-2">{{ PROVIDER_LABEL[p.provider] }}</td>
                <td class="px-2 py-2">{{ PAYMENT_STATUS_LABEL[p.status] }}</td>
                <td class="px-2 py-2">{{ formatPrice(p.amount) }}</td>
                <td class="px-2 py-2" dir="ltr">{{ p.refId ?? '—' }}</td>
                <td class="whitespace-nowrap px-2 py-2">{{ formatDateTime(p.verifiedAt ?? p.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>