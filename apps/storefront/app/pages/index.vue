<script setup lang="ts">
import type { PublicPageDto } from '@myapp/shared-types';

definePageMeta({ alias: ['/preview'] });
const store = useStore();
const api = useStorefrontApi();
const { token } = usePreview();

const { data: page, error } = await useAsyncData(
  () => `page:home:${token.value ?? ''}`,
  () => api<PublicPageDto>('/storefront/pages/home', { query: { preview: token.value } }),
);
if (error.value) throw pageError(error.value);

useSeoMeta({
  title: () => store.value?.name,
  description: () => store.value?.description ?? undefined,
  ogTitle: () => store.value?.name,
  ogDescription: () => store.value?.description ?? undefined,
  ogImage: () => store.value?.logoUrl ?? undefined,
});
</script>

<template>
  <div v-if="page" class="space-y-6">
    <PreviewBanner v-if="page.preview" />
    <BlockRenderer :blocks="page.blocks" />
  </div>
</template>