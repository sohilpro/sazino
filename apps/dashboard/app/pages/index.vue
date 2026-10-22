<script setup lang="ts">
import type { Paginated, ProductDto } from '@myapp/shared-types';

useHead({ title: 'داشبورد' });

const { user, tenant } = useAuth();
const api = useApi();

const { data: productCount } = useLazyAsyncData(
  'dashboard-product-count',
  async () => (await api<Paginated<ProductDto>>('/products', { query: { limit: 1 } })).meta.total,
);
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-extrabold">سلام {{ user?.name }} 👋</h1>
      <p class="text-slate-600">مدیریت فروشگاه «{{ tenant?.name }}»</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink to="/products" class="card transition hover:border-brand-500">
        <div class="text-sm text-slate-500">محصولات</div>
        <div class="mt-1 text-3xl font-extrabold">
          {{ productCount === undefined ? '…' : formatNumber(productCount) }}
        </div>
      </NuxtLink>
      <NuxtLink to="/products/new" class="card flex items-center justify-center text-brand-600 transition hover:border-brand-500">
        + افزودن محصول جدید
      </NuxtLink>
    </div>

    <ApiStatus />
  </div>
</template>