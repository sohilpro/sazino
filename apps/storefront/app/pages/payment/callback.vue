<script setup lang="ts">
import type { PaymentOutcomeDto } from '@myapp/shared-types';

useSeoMeta({ title: 'نتیجه‌ی پرداخت', robots: 'noindex, nofollow' });

const route = useRoute();
const state = ref<'loading' | 'done' | 'error'>('loading');
const result = ref<PaymentOutcomeDto | null>(null);
const error = ref('');

const MESSAGES = {
  FAILED: {
    title: 'پرداخت انجام نشد',
    text: 'پرداخت لغو شد یا ناموفق بود. اگر مبلغی از حساب شما کسر شده، طبق قوانین درگاه بازگردانده می‌شود. می‌توانید دوباره پرداخت کنید.',
    tone: 'text-red-700',
    icon: 'alert',
    bubble: 'bg-red-50 text-red-600',
  },
  PENDING_CHECK: {
    title: 'نتیجه‌ی پرداخت در حال بررسی است',
    text: 'ارتباط با درگاه برقرار نشد و نتیجه هنوز مشخص نیست. چند دقیقه بعد وضعیت سفارش را ببینید؛ نیازی به پرداخت دوباره نیست.',
    tone: 'text-amber-700',
    icon: 'clock',
    bubble: 'bg-amber-50 text-amber-600',
  },
  NOT_PAYABLE: {
    title: 'این سفارش دیگر قابل پرداخت نیست',
    text: 'سفارش لغو شده یا مهلت آن تمام شده است. اگر مبلغی کسر شده، طبق قوانین درگاه به حساب شما برمی‌گردد.',
    tone: 'text-slate-700',
    icon: 'alert',
    bubble: 'bg-slate-100 text-slate-500',
  },
} as const;

onMounted(async () => {
  const authority = firstQuery(route.query.Authority);
  const status = firstQuery(route.query.Status);

  if (!/^[A-Za-z0-9]{10,64}$/.test(authority)) {
    state.value = 'error';
    error.value = 'اطلاعات بازگشت از درگاه نامعتبر است.';
    return;
  }

  try {
    // اجرای مجدد (رفرش صفحه) بی‌خطر است: سرور idempotent است
    const res = await $fetch<PaymentOutcomeDto>('/api/storefront/payments/callback', {
      method: 'POST',
      body: { authority, status: status || 'NOK' },
    });
    result.value = res;
    state.value = 'done';

    if (res.outcome === 'PAID') {
      await navigateTo({ path: `/orders/${res.orderNumber}`, query: { paid: '1' } }, { replace: true });
    }
  } catch (e) {
    state.value = 'error';
    error.value = statusOf(e) === 404 ? 'این پرداخت پیدا نشد.' : apiErrorMessage(e);
  }
});
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <CheckoutSteps :current="3" />

    <div class="card space-y-5 !p-8 text-center">
      <template v-if="state === 'loading'">
        <span class="mx-auto block size-14 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" aria-hidden="true" />
        <div role="status">
          <h1 class="text-xl font-extrabold">در حال بررسی پرداخت…</h1>
          <p class="mt-1 text-sm text-slate-500">لطفاً صفحه را نبندید.</p>
        </div>
      </template>

      <template v-else-if="state === 'error'">
        <span class="mx-auto grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
          <StoreIcon name="alert" :size="28" />
        </span>
        <h1 class="text-xl font-extrabold text-red-700">خطا</h1>
        <p class="text-sm leading-7 text-slate-600">{{ error }}</p>
        <NuxtLink to="/orders" class="btn btn-primary btn-lg">سفارش‌های من</NuxtLink>
      </template>

      <template v-else-if="result && result.outcome !== 'PAID'">
        <span class="mx-auto grid size-14 place-items-center rounded-full" :class="MESSAGES[result.outcome].bubble">
          <StoreIcon :name="MESSAGES[result.outcome].icon" :size="28" />
        </span>
        <h1 class="text-xl font-extrabold" :class="MESSAGES[result.outcome].tone">
          {{ MESSAGES[result.outcome].title }}
        </h1>
        <p class="text-sm leading-7 text-slate-600">{{ MESSAGES[result.outcome].text }}</p>
        <NuxtLink :to="`/orders/${result.orderNumber}`" class="btn btn-primary btn-lg">مشاهده‌ی سفارش</NuxtLink>
      </template>
    </div>
  </div>
</template>
