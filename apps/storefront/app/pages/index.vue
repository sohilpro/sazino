<script setup lang="ts">
import type { PublicPageDto } from '@myapp/shared-types';

definePageMeta({ alias: ['/preview'] });
const isPlatform = useIsPlatform();
const store = useStore();
const api = useStorefrontApi();
const { token } = usePreview();

// فقط اگر در هاست فروشگاه هستیم، اطلاعات صفحه اصلی فروشگاه را از API واکشی کن
const { data: page, error } = isPlatform.value
  ? { data: ref<PublicPageDto | null>(null), error: ref<unknown>(null) }
  : await useAsyncData(
      () => `page:home:${token.value ?? ''}`,
      () => api<PublicPageDto>('/storefront/pages/home', { query: { preview: token.value } }),
    );

if (!isPlatform.value && error.value) throw pageError(error.value);

useSeoMeta({
  title: () =>
    isPlatform.value
      ? 'سازینو | پلتفرم فروشگاه‌ساز و سایت‌ساز ابری و بدون کدنویسی'
      : store.value?.name,
  description: () =>
    isPlatform.value
      ? 'با سازینو بدون نیاز به کدنویسی در کمتر از ۲ دقیقه سایت و فروشگاه اینترنتی حرفه‌ای با درگاه پرداخت بانکی، سئو خودکار و دامنه‌ی اختصاصی راه‌اندازی کنید.'
      : (store.value?.description ?? undefined),
  ogTitle: () =>
    isPlatform.value
      ? 'سازینو | ساخت سریع فروشگاه اینترنتی و وبسایت حرفه‌ای'
      : store.value?.name,
  ogDescription: () =>
    isPlatform.value
      ? 'فروشگاه‌ساز ابری سازینو با قالب‌های متنوع، درگاه پرداخت شتاب و اتصال دامنه اختصاصی'
      : (store.value?.description ?? undefined),
  ogImage: () => store.value?.logoUrl ?? undefined,
});
</script>

<template>
  <!-- ۱) صفحه فرود اصلی پلتفرم سازینو (در هاست localhost:3000 یا دامنه اصلی) -->
  <PlatformLanding v-if="isPlatform" />

  <!-- ۲) ویترین فروشگاه در ساب‌دامین‌ها (مانند demo.localhost:3000) یا دامنه‌های اختصاصی -->
  <div v-else-if="page" class="space-y-6">
    <PreviewBanner v-if="page.preview" />
    <BlockRenderer :blocks="page.blocks" />
  </div>
</template>
