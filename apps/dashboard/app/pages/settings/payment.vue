<script setup lang="ts">
import type { PaymentGatewayDto } from '@myapp/shared-types';

useHead({ title: 'درگاه پرداخت' });

const api = useApi();
const toast = useToast();
const { user } = useAuth();

const isOwner = computed(() => user.value?.role === 'OWNER');
const MERCHANT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const { data: gateway, error, refresh } = await useAsyncData('payment-gateway', () =>
  api<PaymentGatewayDto>('/payment-gateway'),
);

const merchantId = ref('');
const saving = ref(false);

async function save() {
  const value = merchantId.value.trim();
  if (!MERCHANT_RE.test(value)) {
    toast.error('شناسه‌ی پذیرنده باید کد ۳۶ کاراکتری (مثل xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) باشد');
    return;
  }
  saving.value = true;
  try {
    gateway.value = await api<PaymentGatewayDto>('/payment-gateway', {
      method: 'PUT',
      body: { merchantId: value },
    });
    merchantId.value = '';
    toast.success('شناسه‌ی پذیرنده ذخیره شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    saving.value = false;
  }
}

async function setActive(isActive: boolean) {
  try {
    gateway.value = await api<PaymentGatewayDto>('/payment-gateway', { method: 'PUT', body: { isActive } });
    toast.success(isActive ? 'پرداخت آنلاین فعال شد' : 'پرداخت آنلاین غیرفعال شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}

async function remove() {
  if (!confirm('تنظیمات درگاه حذف شود؟ تا ثبت دوباره، مشتریان نمی‌توانند آنلاین پرداخت کنند.')) return;
  try {
    await api('/payment-gateway', { method: 'DELETE' });
    await refresh();
    toast.success('تنظیمات درگاه حذف شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-extrabold">درگاه پرداخت</h1>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="gateway">
      <section class="card space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold">زرین‌پال</h2>
            <p v-if="gateway.configured" class="text-sm text-slate-500">
              شناسه‌ی پذیرنده ثبت شده است (…<span dir="ltr">{{ gateway.merchantHint }}</span>)
            </p>
            <p v-else class="text-sm text-amber-700">هنوز شناسه‌ای ثبت نشده است.</p>
          </div>
          <span
            class="badge"
            :class="gateway.configured && gateway.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'"
          >
            {{ gateway.configured && gateway.isActive ? 'فعال' : 'غیرفعال' }}
          </span>
        </div>

        <template v-if="isOwner">
          <form class="space-y-3" novalidate @submit.prevent="save">
            <label class="block">
              <span class="label">
                {{ gateway.configured ? 'شناسه‌ی پذیرنده‌ی جدید' : 'شناسه‌ی پذیرنده (Merchant ID)' }}
              </span>
              <input
                v-model="merchantId"
                class="input"
                dir="ltr"
                maxlength="36"
                autocomplete="off"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'در حال ذخیره…' : 'ذخیره' }}
            </button>
          </form>

          <div v-if="gateway.configured" class="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" class="btn btn-secondary" @click="setActive(!gateway.isActive)">
              {{ gateway.isActive ? 'غیرفعال‌کردن پرداخت آنلاین' : 'فعال‌کردن پرداخت آنلاین' }}
            </button>
            <button type="button" class="btn btn-secondary text-red-600" @click="remove">حذف تنظیمات</button>
          </div>
        </template>
        <p v-else class="text-sm text-slate-500">فقط مالک فروشگاه می‌تواند درگاه را تنظیم کند.</p>
      </section>

      <section class="card space-y-2 text-sm leading-7 text-slate-600">
        <h2 class="text-lg font-bold text-slate-900">نکات مهم</h2>
        <ul class="list-disc space-y-1 ps-5">
          <li>شناسه‌ی پذیرنده را از پنل زرین‌پال (بخش درگاه‌ها) بردارید.</li>
          <li>شناسه به‌صورت رمزنگاری‌شده ذخیره می‌شود و دوباره نمایش داده نمی‌شود.</li>
          <li>
            زرین‌پال معمولاً دامنه‌ی بازگشت را با دامنه‌ی ثبت‌شده‌ی درگاه مقایسه می‌کند؛ آدرس فروشگاه شما باید با
            دامنه‌ی ثبت‌شده در پنل زرین‌پال یکی باشد.
          </li>
          <li>پول مستقیم به حساب خودتان در زرین‌پال واریز می‌شود، نه به حساب پلتفرم.</li>
        </ul>
      </section>
    </template>
  </div>
</template>