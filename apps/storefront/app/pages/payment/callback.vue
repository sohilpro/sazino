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
  },
  PENDING_CHECK: {
    title: 'نتیجه‌ی پرداخت در حال بررسی است',
    text: 'ارتباط با درگاه برقرار نشد و نتیجه هنوز مشخص نیست. چند دقیقه بعد وضعیت سفارش را ببینید؛ نیازی به پرداخت دوباره نیست.',
    tone: 'text-amber-700',
  },
  NOT_PAYABLE: {
    title: 'این سفارش دیگر قابل پرداخت نیست',
    text: 'سفارش لغو شده یا مهلت آن تمام شده است. اگر مبلغی کسر شده، طبق قوانین درگاه به حساب شما برمی‌گردد.',
    tone: 'text-slate-700',
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
  <div class="mx-auto max-w-lg">
    <div class="card space-y-4 text-center">
      <template v-if="state === 'loading'">
        <h1 class="text-xl font-extrabold">در حال بررسی پرداخت…</h1>
        <p class="text-sm text-slate-500">لطفاً صفحه را نبندید.</p>
      </template>

      <template v-else-if="state === 'error'">
        <h1 class="text-xl font-extrabold text-red-700">خطا</h1>
        <p class="text-sm text-slate-600">{{ error }}</p>
        <NuxtLink to="/orders" class="btn btn-primary">سفارش‌های من</NuxtLink>
      </template>

      <template v-else-if="result && result.outcome !== 'PAID'">
        <h1 class="text-xl font-extrabold" :class="MESSAGES[result.outcome].tone">
          {{ MESSAGES[result.outcome].title }}
        </h1>
        <p class="text-sm leading-7 text-slate-600">{{ MESSAGES[result.outcome].text }}</p>
        <NuxtLink :to="`/orders/${result.orderNumber}`" class="btn btn-primary">مشاهده‌ی سفارش</NuxtLink>
      </template>
    </div>
  </div>
</template>