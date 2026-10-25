<script setup lang="ts">
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

useSeoMeta({ title: 'درگاه آزمایشی', robots: 'noindex, nofollow' });

const route = useRoute();
const authority = computed(() => firstQuery(route.query.authority));
const amount = computed(() => Number(firstQuery(route.query.amount)) || 0);

/** مثل بانک واقعی: مرورگر با Authority و Status به صفحه‌ی بازگشت می‌رود */
function back(status: 'OK' | 'NOK') {
  window.location.href = `/payment/callback?Authority=${encodeURIComponent(authority.value)}&Status=${status}`;
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <div class="card space-y-4 text-center">
      <h1 class="text-xl font-extrabold">درگاه پرداخت آزمایشی</h1>
      <p class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        این صفحه فقط در حالت توسعه وجود دارد و پولی جابه‌جا نمی‌شود.
      </p>
      <div class="text-3xl font-extrabold text-brand-700">{{ formatPrice(amount) }}</div>
      <p class="break-all text-xs text-slate-500" dir="ltr">{{ authority }}</p>
      <div class="flex gap-2">
        <button type="button" class="btn btn-primary flex-1" @click="back('OK')">پرداخت موفق</button>
        <button type="button" class="btn btn-secondary flex-1" @click="back('NOK')">انصراف</button>
      </div>
    </div>
  </div>
</template>