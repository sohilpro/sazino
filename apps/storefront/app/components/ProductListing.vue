<script setup lang="ts">
import type { Paginated, ProductDto } from '@myapp/shared-types';
import type { SortValue } from '~/utils/labels';

defineProps<{
  data?: Paginated<ProductDto> | null;
  error?: unknown;
  sort: SortValue;
  emptyText?: string;
}>();

const route = useRoute();
const router = useRouter();

function onSort(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  void router.push({
    query: mergeQuery(route.query, { sort: value === 'newest' ? undefined : value, page: undefined }),
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
      <p class="text-sm text-slate-500">
        {{ data ? `${formatNumber(data.meta.total)} محصول` : '' }}
      </p>
      <label class="flex items-center gap-2 text-sm text-slate-600">
        <span>مرتب‌سازی:</span>
        <select
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          :value="sort"
          @change="onSort"
        >
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      <StoreIcon name="alert" :size="32" class="mx-auto mb-2" />
      <p class="mb-3">بارگذاری محصولات ناموفق بود.</p>
      <button type="button" class="btn btn-secondary" @click="reloadNuxtApp()">تلاش مجدد</button>
    </div>

    <template v-else-if="data">
      <div
        v-if="!data.items.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
      >
        <span class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <StoreIcon :name="data.meta.total > 0 ? 'box' : 'search'" :size="28" />
        </span>
        <p class="font-medium text-slate-700">
          {{ data.meta.total > 0 ? 'این صفحه محصولی ندارد.' : (emptyText ?? 'محصولی پیدا نشد.') }}
        </p>
        <NuxtLink v-if="route.path !== '/products' || data.meta.total > 0 || route.query.q" to="/products" class="btn btn-secondary mt-5">
          مشاهده‌ی همه‌ی محصولات
        </NuxtLink>
      </div>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in data.items" :key="p.id" :product="p" />
      </div>

      <AppPagination :meta="data.meta" />
    </template>
  </div>
</template>
