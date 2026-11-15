<script setup lang="ts">
import type { ProductDto } from '@myapp/shared-types';

const route = useRoute();
const api = useApi();
const id = String(route.params.id);

const { data: product, error } = await useAsyncData(`product-${id}`, () =>
  api<ProductDto>(`/products/${id}`),
);

useHead({ title: () => product.value?.title ?? 'ویرایش محصول' });

function onSaved(updated: ProductDto) {
  product.value = updated;
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="product?.title ?? 'ویرایش محصول'"
      back-to="/products"
      back-label="محصولات"
    >
      <template v-if="product" #meta><StatusBadge :status="product.status" /></template>
    </PageHeader>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">
        {{ statusOf(error) === 404 ? 'این محصول پیدا نشد.' : apiErrorMessage(error) }}
      </p>
      <NuxtLink to="/products" class="btn btn-secondary">بازگشت به لیست</NuxtLink>
    </div>

    <ProductForm v-else-if="product" :key="product.id" :product="product" @saved="onSaved" />
  </div>
</template>
