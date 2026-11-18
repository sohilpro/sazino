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
  <div class="max-w-5xl space-y-6">
    <PageHeader title="تنظیمات" subtitle="ظاهر و اطلاعات فروشگاه، پرداخت، دامنه و پلن" />
    <SettingsTabs />

    <p v-if="error" class="alert-error">{{ apiErrorMessage(error) }}</p>

    <div v-else-if="gateway" class="grid gap-6 lg:grid-cols-5">
      <section class="card space-y-5 lg:col-span-3">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <AppIcon name="payment" :size="22" />
            </span>
            <div>
              <h2 class="text-lg font-bold">زرین‌پال</h2>
              <p class="text-sm text-slate-500">پرداخت آنلاین با کارت‌های بانکی</p>
            </div>
          </div>
          <span
            class="badge gap-1.5"
            :class="gateway.configured && gateway.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'"
          >
            <span
              class="size-1.5 rounded-full"
              :class="gateway.configured && gateway.isActive ? 'bg-emerald-500' : 'bg-slate-400'"
            />
            {{ gateway.configured && gateway.isActive ? 'فعال' : 'غیرفعال' }}
          </span>
        </div>

        <p v-if="!gateway.configured" class="alert-warn">
          هنوز شناسه‌ی پذیرنده‌ای ثبت نشده است؛ تا آن موقع مشتری‌ها نمی‌توانند آنلاین پرداخت کنند.
        </p>
        <p v-else class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          شناسه‌ی پذیرنده ثبت شده است:
          <span class="tech font-medium">…{{ gateway.merchantHint }}</span>
        </p>

        <template v-if="isOwner">
          <form class="space-y-3" novalidate @submit.prevent="save">
            <label class="block">
              <span class="label">
                {{ gateway.configured ? 'شناسه‌ی پذیرنده‌ی جدید' : 'شناسه‌ی پذیرنده (Merchant ID)' }}
              </span>
              <input
                v-model="merchantId"
                class="input tech"
                dir="ltr"
                maxlength="36"
                autocomplete="off"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'در حال ذخیره…' : gateway.configured ? 'جایگزینی شناسه' : 'ذخیره' }}
            </button>
          </form>

          <div v-if="gateway.configured" class="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" class="btn btn-secondary" @click="setActive(!gateway.isActive)">
              {{ gateway.isActive ? 'غیرفعال‌کردن پرداخت آنلاین' : 'فعال‌کردن پرداخت آنلاین' }}
            </button>
            <button type="button" class="btn btn-ghost text-red-600 hover:!bg-red-50" @click="remove">
              <AppIcon name="trash" :size="16" />
              حذف تنظیمات
            </button>
          </div>
        </template>
        <p v-else class="flex items-center gap-2 text-sm text-slate-500">
          <AppIcon name="lock" :size="16" />
          فقط مالک فروشگاه می‌تواند درگاه را تنظیم کند.
        </p>
      </section>

      <aside class="lg:col-span-2">
        <section class="card space-y-3 text-sm leading-7 text-slate-600">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <AppIcon name="info" :size="20" class="text-brand-600" />
            نکات مهم
          </h2>
          <ul class="list-disc space-y-1.5 ps-5">
            <li>شناسه‌ی پذیرنده را از پنل زرین‌پال (بخش درگاه‌ها) بردارید.</li>
            <li>شناسه به‌صورت رمزنگاری‌شده ذخیره می‌شود و دوباره نمایش داده نمی‌شود.</li>
            <li>
              زرین‌پال معمولاً دامنه‌ی بازگشت را با دامنه‌ی ثبت‌شده‌ی درگاه مقایسه می‌کند؛ آدرس فروشگاه شما باید با
              دامنه‌ی ثبت‌شده در پنل زرین‌پال یکی باشد.
            </li>
            <li>پول مستقیم به حساب خودتان در زرین‌پال واریز می‌شود، نه به حساب پلتفرم.</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
