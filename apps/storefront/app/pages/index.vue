<script setup lang="ts">
import type { PublicPageDto } from '@myapp/shared-types';

const store = useStore();
const api = useStorefrontApi();

const { data: page, error } = await useAsyncData('page:home', () =>
  api<PublicPageDto>('/storefront/pages/home'),
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
  <BlockRenderer v-if="page" :blocks="page.blocks" />
</template>