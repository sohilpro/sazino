<script setup lang="ts">
import type { PublicPageDto } from '@myapp/shared-types';

const route = useRoute();
const api = useStorefrontApi();
const siteUrl = useSiteUrl();

const slug = computed(() => String(route.params.slug));

// slug نامعتبر اصلاً به API نمی‌رود
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value) || slug.value.length > 60) throw notFoundError();

const { data: page, error } = await useAsyncData(
  () => `page:${slug.value}`,
  () => api<PublicPageDto>(`/storefront/pages/${slug.value}`),
);
if (error.value) throw pageError(error.value);

const startsWithHero = computed(() => page.value?.blocks[0]?.type === 'hero');
const canonical = computed(() => siteUrl(`/p/${slug.value}`));

useSeoMeta({
  title: () => page.value?.title,
  ogTitle: () => page.value?.title,
  ogUrl: () => canonical.value,
});
useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }] }));
</script>

<template>
  <div v-if="page" class="space-y-8">
    <h1 v-if="!startsWithHero" class="text-3xl font-extrabold">{{ page.title }}</h1>
    <BlockRenderer :blocks="page.blocks" />
  </div>
</template>