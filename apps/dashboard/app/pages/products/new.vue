<script setup lang="ts">
import type { ProductDto } from '@myapp/shared-types';

useHead({ title: 'محصول جدید' });

async function onSaved(product: ProductDto) {
  await navigateTo(`/products/${product.id}`);
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <NuxtLink to="/products" class="text-sm text-slate-500 hover:text-brand-600">
        → بازگشت به محصولات
      </NuxtLink>
      <h1 class="mt-1 text-2xl font-extrabold">محصول جدید</h1>
    </header>

    <ProductForm @saved="onSaved" />
  </div>
</template>