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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate-500">
        {{ data ? `${formatNumber(data.meta.total)} محصول` : '' }}
      </p>
      <label class="flex items-center gap-2 text-sm text-slate-600">
        <span>مرتب‌سازی:</span>
        <select
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          :value="sort"
          @change="onSort"
        >
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
      بارگذاری محصولات ناموفق بود. صفحه را دوباره بارگذاری کنید.
    </p>

    <template v-else-if="data">
      <p
        v-if="!data.items.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"
      >
        {{ data.meta.total > 0 ? 'این صفحه محصولی ندارد.' : (emptyText ?? 'محصولی پیدا نشد.') }}
      </p>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in data.items" :key="p.id" :product="p" />
      </div>

      <AppPagination :meta="data.meta" />
    </template>
  </div>
</template>