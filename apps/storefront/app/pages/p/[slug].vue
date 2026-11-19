<script setup lang="ts">
import type { PublicPageDto } from '@myapp/shared-types';

definePageMeta({ alias: ['/preview/p/:slug'] });
const route = useRoute();
const api = useStorefrontApi();
const siteUrl = useSiteUrl();
const { token } = usePreview();

const slug = computed(() => String(route.params.slug));

// slug نامعتبر اصلاً به API نمی‌رود
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value) || slug.value.length > 60) throw notFoundError();

const { data: page, error } = await useAsyncData(
  () => `page:${slug.value}:${token.value ?? ''}`,
  () => api<PublicPageDto>(`/storefront/pages/${slug.value}`, { query: { preview: token.value } }),
);
if (error.value) throw pageError(error.value);

const startsWithHero = computed(() => page.value?.blocks[0]?.type === 'hero');
const canonical = computed(() => siteUrl(`/p/${slug.value}`));

useSeoMeta({
  title: () => page.value?.title,
  ogTitle: () => page.value?.title,
  ogUrl: () => canonical.value,
});
// نسخه‌ی پیش‌نمایش canonical ندارد
useHead(() => ({ link: page.value?.preview ? [] : [{ rel: 'canonical', href: canonical.value }] }));
</script>

<template>
  <div v-if="page" class="space-y-8">
    <PreviewBanner v-if="page.preview" />
    <Breadcrumbs :items="[{ label: 'خانه', to: '/' }, { label: page.title }]" />

    <header v-if="!startsWithHero" class="space-y-3 pb-2 text-center">
      <h1 class="text-3xl font-extrabold leading-tight sm:text-4xl">{{ page.title }}</h1>
      <span class="mx-auto block h-1 w-14 rounded-full bg-brand-600" aria-hidden="true" />
    </header>

    <BlockRenderer :blocks="page.blocks" />
  </div>
</template>
