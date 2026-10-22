<script setup lang="ts">
import type { Paginated, ProductDto } from '@myapp/shared-types';
import type { LocationQueryRaw } from 'vue-router';

useHead({ title: 'محصولات' });

const api = useApi();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { canDelete } = useAuth();

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const filters = computed(() => {
  const page = Math.floor(Number(route.query.page));
  return {
    page: page > 0 && page <= 100_000 ? page : 1,
    q: str(route.query.q),
    status: str(route.query.status),
    sort: str(route.query.sort) || 'newest',
  };
});

const { data, status, error, refresh } = await useAsyncData(
  'products',
  () =>
    api<Paginated<ProductDto>>('/products', {
      query: {
        page: filters.value.page,
        limit: 20,
        q: filters.value.q,
        status: filters.value.status,
        sort: filters.value.sort,
      },
    }),
  { watch: [filters] },
);

function setQuery(patch: Record<string, string | number | undefined>) {
  const next = { ...route.query, ...patch } as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    if (next[key] === undefined || next[key] === '') delete next[key];
  }
  void router.replace({ query: next as LocationQueryRaw });
}

// جستجو با تأخیر ۳۵۰ میلی‌ثانیه
const search = ref(filters.value.q);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => setQuery({ q: value.trim() || undefined, page: undefined }), 350);
});
onBeforeUnmount(() => clearTimeout(timer));

const totalStock = (p: ProductDto) => p.variants.reduce((sum, v) => sum + (v.quantity ?? 0), 0);
const hasFilters = computed(() => Boolean(filters.value.q || filters.value.status));

async function remove(p: ProductDto) {
  if (!confirm(`محصول «${p.title}» حذف شود؟ این کار قابل بازگشت نیست.`)) return;
  try {
    await api(`/products/${p.id}`, { method: 'DELETE' });
    toast.success('محصول حذف شد');
    // اگر آخرین مورد صفحه حذف شد، یک صفحه عقب برو
    if (data.value?.items.length === 1 && filters.value.page > 1) {
      setQuery({ page: filters.value.page - 1 });
    } else {
      await refresh();
    }
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold">محصولات</h1>
      <NuxtLink to="/products/new" class="btn btn-primary">+ محصول جدید</NuxtLink>
    </header>

    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <label class="min-w-56 flex-1">
        <span class="label">جستجو</span>
        <input v-model="search" class="input" placeholder="عنوان یا SKU" />
      </label>
      <label>
        <span class="label">وضعیت</span>
        <select
          class="input"
          :value="filters.status"
          @change="setQuery({ status: ($event.target as HTMLSelectElement).value, page: undefined })"
        >
          <option value="">همه</option>
          <option v-for="o in PRODUCT_STATUS_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </label>
      <label>
        <span class="label">مرتب‌سازی</span>
        <select
          class="input"
          :value="filters.sort"
          @change="setQuery({ sort: ($event.target as HTMLSelectElement).value, page: undefined })"
        >
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">{{ apiErrorMessage(error) }}</p>
      <button type="button" class="btn btn-secondary" @click="() => refresh()">تلاش مجدد</button>
    </div>

    <template v-else-if="data">
      <div
        v-if="data.items.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"
      >
        <p class="mb-3">
          {{ hasFilters ? 'محصولی با این فیلترها پیدا نشد.' : 'هنوز محصولی ندارید.' }}
        </p>
        <NuxtLink v-if="!hasFilters" to="/products/new" class="btn btn-primary">
          اولین محصول را بسازید
        </NuxtLink>
      </div>

      <div
        v-else
        class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm transition"
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 text-start font-medium">محصول</th>
              <th class="px-4 py-3 text-start font-medium">وضعیت</th>
              <th class="px-4 py-3 text-start font-medium">دسته‌بندی</th>
              <th class="px-4 py-3 text-start font-medium">قیمت</th>
              <th class="px-4 py-3 text-start font-medium">موجودی</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in data.items" :key="p.id" class="hover:bg-slate-50">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <img
                    v-if="p.images[0]"
                    :src="p.images[0].urls.thumb"
                    :alt="p.images[0].alt ?? ''"
                    class="size-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div
                    v-else
                    class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400"
                  >
                    بدون عکس
                  </div>
                  <div class="min-w-0">
                    <NuxtLink
                      :to="`/products/${p.id}`"
                      class="block truncate font-medium hover:text-brand-600"
                    >
                      {{ p.title }}
                    </NuxtLink>
                    <span class="block truncate text-xs text-slate-400" dir="ltr">{{ p.slug }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3"><StatusBadge :status="p.status" /></td>
              <td class="px-4 py-3 text-slate-600">{{ p.category?.name ?? '—' }}</td>
              <td class="whitespace-nowrap px-4 py-3">
                {{ formatPriceRange(p.minPrice, p.maxPrice) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="badge"
                  :class="p.inStock ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                >
                  {{ p.inStock ? 'موجود' : 'ناموجود' }}
                </span>
                <span class="ms-2 text-xs text-slate-500">{{ formatNumber(totalStock(p)) }} عدد</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-end">
                <NuxtLink :to="`/products/${p.id}`" class="btn btn-secondary btn-sm">ویرایش</NuxtLink>
                <button
                  v-if="canDelete"
                  type="button"
                  class="btn btn-secondary btn-sm ms-1 text-red-600"
                  @click="remove(p)"
                >
                  حذف
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination
        :meta="data.meta"
        @change="(n) => setQuery({ page: n === 1 ? undefined : n })"
      />
    </template>
  </div>
</template>