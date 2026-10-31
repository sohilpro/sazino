<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

useStoreTheme();

const MESSAGES: Record<number, { title: string; text: string }> = {
  404: {
    title: 'صفحه یا فروشگاه پیدا نشد',
    text: 'آدرسی که وارد کرده‌اید وجود ندارد. آدرس را بررسی کنید.',
  },
  403: {
    title: 'این فروشگاه موقتاً غیرفعال است',
    text: 'لطفاً بعداً دوباره سر بزنید.',
  },
  502: {
    title: 'سرویس موقتاً در دسترس نیست',
    text: 'مشکلی در ارتباط با سرور پیش آمده؛ چند لحظه بعد دوباره تلاش کنید.',
  },
  410: {
    title: 'پیوند پیش‌نمایش منقضی شده است',
    text: 'پیوند پیش‌نمایش فقط ۳۰ دقیقه معتبر است. از پنل فروشنده دوباره پیش‌نمایش بگیرید.',
  },
};

// اگر کد وضعیت نبود، خطای سرور (۵۰۰) فرض می‌شود
const statusCode = computed(() => props.error.status ?? 500);

const info = computed(
  () =>
    MESSAGES[statusCode.value] ?? {
      title: 'خطایی رخ داد',
      text: 'کمی بعد دوباره تلاش کنید.',
    },
);

useHead({ title: () => info.value.title });

const goHome = () => clearError({ redirect: '/' });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div
      class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <div class="mb-2 text-5xl font-extrabold text-brand-600">
        {{ formatNumber(statusCode) }}
      </div>
      <h1 class="mb-2 text-xl font-bold">{{ info.title }}</h1>
      <p class="mb-6 text-sm text-slate-600">{{ info.text }}</p>
      <button type="button" class="btn btn-primary" @click="goHome">بازگشت به صفحه‌ی اصلی</button>
    </div>
  </div>
</template>
