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

type StepState = 'done' | 'current' | 'todo' | 'canceled';
interface TimelineStep {
  key: string;
  label: string;
  at: string | null;
  state: StepState;
}

/** خط زمانی سفارش: ثبت ← پرداخت ← ارسال (یا لغو) */
const timeline = computed<TimelineStep[]>(() => {
  const o = order.value;
  if (!o) return [];
  const created: TimelineStep = { key: 'created', label: 'ثبت سفارش', at: o.createdAt, state: 'done' };

  if (o.status === 'CANCELED') {
    const steps = [created];
    if (o.paidAt) steps.push({ key: 'paid', label: 'پرداخت', at: o.paidAt, state: 'done' });
    steps.push({ key: 'canceled', label: 'لغو شد', at: o.canceledAt, state: 'canceled' });
    return steps;
  }

  const paid: TimelineStep = {
    key: 'paid',
    label: 'پرداخت',
    at: o.paidAt,
    state: o.paidAt ? 'done' : 'current',
  };
  const shipped: TimelineStep = {
    key: 'shipped',
    label: 'ارسال',
    at: o.shippedAt,
    state: o.shippedAt ? 'done' : o.paidAt ? 'current' : 'todo',
  };
  return [created, paid, shipped];
});

const PROVIDER_LABEL = { ZARINPAL: 'زرین‌پال', MANUAL: 'ثبت دستی' } as const;
const PAYMENT_STATUS_LABEL = { INITIATED: 'در جریان', PAID: 'موفق', FAILED: 'ناموفق' } as const;
</script>

<template>
  <div class="space-y-6">
    <div v-if="error" class="space-y-4">
      <NuxtLink to="/orders" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <AppIcon name="arrowRight" :size="16" />
        سفارش‌ها
      </NuxtLink>
      <div class="card text-center">
        <p class="mb-3 text-red-600">
          {{ statusOf(error) === 404 ? 'این سفارش پیدا نشد.' : apiErrorMessage(error) }}
        </p>
        <NuxtLink to="/orders" class="btn btn-secondary">بازگشت به لیست</NuxtLink>
      </div>
    </div>

    <template v-else-if="order">
      <PageHeader
        :title="`سفارش #${formatNumber(order.number)}`"
        :subtitle="`ثبت‌شده در ${formatDateTime(order.createdAt)}`"
        back-to="/orders"
        back-label="سفارش‌ها"
      >
        <template #meta>
          <span class="badge gap-1.5" :class="ORDER_STATUS_CLASS[order.status]">
            <span class="size-1.5 rounded-full" :class="ORDER_STATUS_DOT[order.status]" />
            {{ ORDER_STATUS_LABEL[order.status] }}
          </span>
        </template>
      </PageHeader>

      <!-- خط زمانی -->
      <ol class="card flex items-start !p-5" aria-label="مراحل سفارش">
        <li v-for="(step, i) in timeline" :key="step.key" class="flex flex-1 items-start gap-3 last:flex-none">
          <div class="flex flex-col items-center gap-1.5 text-center">
            <span
              class="grid size-8 place-items-center rounded-full text-sm font-bold"
              :class="{
                'bg-emerald-500 text-white': step.state === 'done',
                'bg-brand-600 text-white ring-4 ring-brand-100': step.state === 'current',
                'bg-slate-200 text-slate-500': step.state === 'todo',
                'bg-red-500 text-white': step.state === 'canceled',
              }"
            >
              <AppIcon v-if="step.state === 'done'" name="check" :size="16" />
              <AppIcon v-else-if="step.state === 'canceled'" name="close" :size="16" />
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
          <!-- اقدامات -->
          <section class="card space-y-4">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <AppIcon name="truck" :size="20" class="text-brand-600" />
              اقدامات
            </h2>

            <template v-if="order.status === 'PENDING'">
              <p class="alert-warn">
                این سفارش هنوز پرداخت نشده است
                <span v-if="order.expiresAt">(مهلت تا {{ formatDateTime(order.expiresAt) }})</span>.
              </p>
              <div v-if="canManage" class="flex flex-wrap items-end gap-2">
                <label class="min-w-56 flex-1">
                  <span class="label">شماره‌ی پیگیری یا توضیح (اختیاری)</span>
                  <input v-model="reference" class="input" maxlength="100" placeholder="مثلاً: کارت‌به‌کارت — ۴۵۶۷" />
                </label>
                <button type="button" class="btn btn-primary" :disabled="busy" @click="markPaid">ثبت پرداخت دستی</button>
                <button type="button" class="btn btn-secondary text-red-600" :disabled="busy" @click="cancel">
                  لغو سفارش
                </button>
              </div>
              <p v-else class="text-sm text-slate-500">فقط مالک و مدیر می‌توانند پرداخت را ثبت یا سفارش را لغو کنند.</p>
            </template>

            <template v-else-if="order.status === 'PAID'">
              <div class="flex flex-wrap items-end gap-2">
                <label class="min-w-56 flex-1">
                  <span class="label">کد رهگیری مرسوله (اختیاری)</span>
                  <input v-model="tracking" class="input tech" dir="ltr" maxlength="64" />
                </label>
                <button type="button" class="btn btn-primary" :disabled="busy" @click="ship">ثبت ارسال</button>
                <button v-if="canManage" type="button" class="btn btn-secondary text-red-600" :disabled="busy" @click="cancel">
                  لغو سفارش
                </button>
              </div>
              <p class="hint">
                با ثبت ارسال، پیامک اطلاع‌رسانی برای مشتری فرستاده می‌شود (اگر پترن آن تنظیم شده باشد).
              </p>
            </template>

            <p v-else-if="order.status === 'SHIPPED'" class="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              ارسال شده در {{ order.shippedAt ? formatDateTime(order.shippedAt) : '' }}
              <template v-if="order.trackingCode">
                · کد رهگیری: <b class="tech">{{ order.trackingCode }}</b>
              </template>
            </p>

            <p v-else class="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {{ CANCEL_REASON_LABEL[order.cancelReason ?? ''] ?? 'این سفارش لغو شده است.' }}
            </p>
          </section>

          <!-- کالاها -->
          <FormSection title="کالاها" :description="`${formatNumber(order.items.length)} قلم`">
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
                  class="size-14 shrink-0 rounded-lg border border-slate-100 object-cover"
                />
                <span v-else class="grid size-14 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                  <AppIcon name="products" :size="22" />
                </span>
                <div class="min-w-0 flex-1 text-sm">
                  <div class="truncate font-medium">{{ item.productTitle }}</div>
                  <div v-if="item.variantTitle !== 'پیش‌فرض'" class="text-xs text-slate-500">{{ item.variantTitle }}</div>
                  <div class="text-xs text-slate-500">
                    {{ formatNumber(item.quantity) }} × {{ formatPrice(item.unitPrice) }}
                  </div>
                </div>
                <div class="shrink-0 text-sm font-medium">{{ formatPrice(item.lineTotal) }}</div>
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
                <dd class="text-brand-600">{{ formatPrice(order.total) }}</dd>
              </div>
            </dl>
          </FormSection>

          <!-- پرداخت‌ها -->
          <FormSection title="پرداخت‌ها">
            <p v-if="!order.payments.length" class="text-sm text-slate-500">
              هنوز تلاشی برای پرداخت ثبت نشده است.
            </p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="border-b border-slate-200 text-xs text-slate-500">
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
                    <td class="px-2 py-2">
                      <span
                        class="badge"
                        :class="{
                          'bg-emerald-100 text-emerald-700': p.status === 'PAID',
                          'bg-amber-100 text-amber-700': p.status === 'INITIATED',
                          'bg-red-100 text-red-700': p.status === 'FAILED',
                        }"
                      >
                        {{ PAYMENT_STATUS_LABEL[p.status] }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-2 py-2">{{ formatPrice(p.amount) }}</td>
                    <td class="tech px-2 py-2">{{ p.refId ?? '—' }}</td>
                    <td class="whitespace-nowrap px-2 py-2">{{ formatDateTime(p.verifiedAt ?? p.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </FormSection>
        </div>

        <!-- ستون کناری: مشتری و نشانی -->
        <aside class="space-y-6">
          <section class="card space-y-3">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <AppIcon name="user" :size="20" class="text-brand-600" />
              مشتری
            </h2>
            <div class="text-sm">
              <div class="font-medium">{{ order.customer.name || 'بدون نام' }}</div>
              <a :href="`tel:${order.customer.phone}`" class="tech text-brand-600 hover:underline">
                {{ order.customer.phone }}
              </a>
            </div>
          </section>

          <section class="card space-y-3">
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <AppIcon name="mapPin" :size="20" class="text-brand-600" />
              نشانی تحویل
            </h2>
            <div class="space-y-1 text-sm leading-7">
              <div class="font-medium">{{ order.address.recipientName }}</div>
              <a :href="`tel:${order.address.recipientPhone}`" class="tech text-brand-600 hover:underline">
                {{ order.address.recipientPhone }}
              </a>
              <div>{{ order.address.province }}، {{ order.address.city }}، {{ order.address.address }}</div>
              <div class="text-slate-600">
                کد پستی: <span class="tech">{{ order.address.postalCode }}</span>
              </div>
            </div>
            <div v-if="order.note" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <div class="mb-0.5 text-xs font-bold">توضیحات مشتری</div>
              {{ order.note }}
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
