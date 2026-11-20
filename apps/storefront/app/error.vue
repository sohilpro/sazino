<script setup lang="ts">
import type { NuxtError } from '#app';
import type { StoreIconName } from '~/components/StoreIcon.vue';

const props = defineProps<{ error: NuxtError }>();

useStoreTheme();
// بسته به نوع خطا ممکن است فروشگاه هنوز بارگذاری نشده باشد (مثلاً دامنه‌ی ناشناخته)
const store = useStore();

const MESSAGES: Record<number, { title: string; text: string; icon: StoreIconName }> = {
  404: {
    title: 'صفحه یا فروشگاه پیدا نشد',
    text: 'آدرسی که وارد کرده‌اید وجود ندارد. آدرس را بررسی کنید.',
    icon: 'search',
  },
  403: {
    title: 'این فروشگاه موقتاً غیرفعال است',
    text: 'لطفاً بعداً دوباره سر بزنید.',
    icon: 'lock',
  },
  502: {
    title: 'سرویس موقتاً در دسترس نیست',
    text: 'مشکلی در ارتباط با سرور پیش آمده؛ چند لحظه بعد دوباره تلاش کنید.',
    icon: 'alert',
  },
  410: {
    title: 'پیوند پیش‌نمایش منقضی شده است',
    text: 'پیوند پیش‌نمایش فقط ۳۰ دقیقه معتبر است. از پنل فروشنده دوباره پیش‌نمایش بگیرید.',
    icon: 'clock',
  },
};

// اگر کد وضعیت نبود، خطای سرور (۵۰۰) فرض می‌شود
const statusCode = computed(() => props.error.status ?? 500);

const info = computed(
  () =>
    MESSAGES[statusCode.value] ?? {
      title: 'خطایی رخ داد',
      text: 'کمی بعد دوباره تلاش کنید.',
      icon: 'alert' as StoreIconName,
    },
);

// در توسعه، دلیل رایج ۴۰۴ باز کردن localhost بدون ساب‌دامین فروشگاه است
const showDevHint = computed(() => import.meta.dev && statusCode.value === 404);

const canRetry = computed(() => statusCode.value >= 500);
const canBrowse = computed(() => statusCode.value === 404 && Boolean(store.value));

useHead({ title: () => info.value.title });

const goHome = () => clearError({ redirect: '/' });
const goProducts = () => clearError({ redirect: '/products' });
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <header v-if="store" class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center px-4 py-3">
        <button type="button" class="flex items-center gap-3" @click="goHome">
          <img v-if="store.logoUrl" :src="store.logoUrl" :alt="store.name" class="h-9 w-auto max-w-28 object-contain" />
          <span v-else class="flex size-9 items-center justify-center rounded-xl bg-brand-600 font-extrabold text-on-brand">
            {{ [...store.name][0] }}
          </span>
          <span class="text-lg font-extrabold">{{ store.name }}</span>
        </button>
      </div>
    </header>

    <main class="flex flex-1 items-center justify-center p-4">
      <div class="w-full max-w-md text-center">
        <div class="relative mb-6 select-none">
          <div class="text-8xl font-extrabold leading-none text-brand-100 sm:text-9xl" aria-hidden="true">
            {{ formatNumber(statusCode) }}
          </div>
          <span
            class="absolute inset-0 m-auto grid size-16 place-items-center rounded-2xl bg-white text-brand-600 shadow-card ring-1 ring-slate-200"
          >
            <StoreIcon :name="info.icon" :size="32" />
          </span>
        </div>

        <h1 class="mb-2 text-xl font-extrabold sm:text-2xl">{{ info.title }}</h1>
        <p class="mb-8 text-sm leading-7 text-slate-600">{{ info.text }}</p>

        <p
          v-if="showDevHint"
          class="mb-6 rounded-xl bg-amber-50 p-3 text-start text-xs leading-6 text-amber-900"
          dir="ltr"
        >
          dev: stores are resolved by host. Open a store via its subdomain, e.g.
          <b>http://demo.localhost:3000</b> (not http://localhost:3000).
        </p>

        <div class="flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" class="btn btn-primary btn-lg" @click="goHome">بازگشت به صفحه‌ی اصلی</button>
          <button v-if="canRetry" type="button" class="btn btn-secondary btn-lg" @click="reloadNuxtApp()">
            تلاش مجدد
          </button>
          <button v-else-if="canBrowse" type="button" class="btn btn-secondary btn-lg" @click="goProducts">
            مشاهده‌ی محصولات
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
