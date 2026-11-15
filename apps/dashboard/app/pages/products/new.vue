<script setup lang="ts">
import type { ProductDto } from '@myapp/shared-types';

useHead({ title: 'محصول جدید' });

async function onSaved(product: ProductDto) {
  await navigateTo(`/products/${product.id}`);
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="محصول جدید"
      subtitle="اطلاعات، تصاویر و قیمت را وارد کنید؛ بعد از ساخت، همیشه می‌توانید ویرایش کنید."
      back-to="/products"
      back-label="محصولات"
    />
    <ProductForm @saved="onSaved" />
  </div>
</template>
