<script setup lang="ts">
import type { ProductStatus } from '@myapp/shared-types';

defineProps<{ status: ProductStatus }>();
</script>

<template>
  <span class="badge" :class="PRODUCT_STATUS_CLASS[status]">{{ PRODUCT_STATUS_LABEL[status] }}</span>
</template>