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
const LOW_STOCK = 5;

const statusTabs = [{ value: '', label: 'همه' }, ...PRODUCT_STATUS_OPTIONS];

function clearFilters() {
  search.value = '';
  void router.replace({ query: {} });
}

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
  <div class="space-y-5">
    <PageHeader
      title="محصولات"
      :subtitle="data && !hasFilters ? `${formatNumber(data.meta.total)} محصول` : undefined"
    >
      <NuxtLink to="/products/new" class="btn btn-primary">
        <AppIcon name="plus" :size="18" />
        محصول جدید
      </NuxtLink>
    </PageHeader>

    <div class="card flex flex-wrap items-center gap-3 !p-3">
      <div class="min-w-56 flex-1"><SearchInput v-model="search" placeholder="جستجوی عنوان یا SKU" /></div>
      <div class="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="وضعیت محصول">
        <button
          v-for="t in statusTabs"
          :key="t.value"
          type="button"
          role="tab"
          :aria-selected="filters.status === t.value"
          class="rounded-md px-3 py-1 text-sm transition"
          :class="
            filters.status === t.value
              ? 'bg-white font-semibold text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          "
          @click="setQuery({ status: t.value, page: undefined })"
        >
          {{ t.label }}
        </button>
      </div>
      <select
        class="input !w-auto"
        aria-label="مرتب‌سازی"
        :value="filters.sort"
        @change="setQuery({ sort: ($event.target as HTMLSelectElement).value, page: undefined })"
      >
        <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <button v-if="hasFilters" type="button" class="btn btn-ghost btn-sm" @click="clearFilters">
        <AppIcon name="close" :size="14" />
        پاک کردن فیلترها
      </button>
    </div>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">{{ apiErrorMessage(error) }}</p>
      <button type="button" class="btn btn-secondary" @click="() => refresh()">تلاش مجدد</button>
    </div>

    <template v-else-if="data">
      <EmptyState
        v-if="data.items.length === 0 && hasFilters"
        icon="search"
        title="محصولی با این فیلترها پیدا نشد"
        description="عبارت جستجو یا وضعیت را تغییر دهید."
      >
        <button type="button" class="btn btn-secondary" @click="clearFilters">پاک کردن فیلترها</button>
      </EmptyState>

      <EmptyState
        v-else-if="data.items.length === 0"
        icon="products"
        title="هنوز محصولی ندارید"
        description="با افزودن اولین محصول، فروشگاهتان آماده‌ی فروش می‌شود."
      >
        <NuxtLink to="/products/new" class="btn btn-primary">
          <AppIcon name="plus" :size="18" />
          اولین محصول را بسازید
        </NuxtLink>
      </EmptyState>

      <template v-else>
        <div :class="status === 'pending' ? 'pointer-events-none opacity-60 transition' : 'transition'">
          <!-- جدول (دسکتاپ) -->
          <div class="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
            <table class="w-full text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-4 py-3 text-start font-medium">محصول</th>
                  <th class="px-4 py-3 text-start font-medium">وضعیت</th>
                  <th class="px-4 py-3 text-start font-medium">دسته‌بندی</th>
                  <th class="px-4 py-3 text-start font-medium">قیمت</th>
                  <th class="px-4 py-3 text-start font-medium">موجودی</th>
                  <th class="w-24 px-4 py-3"><span class="sr-only">عملیات</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="p in data.items" :key="p.id" class="transition hover:bg-slate-50">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/products/${p.id}`" class="flex items-center gap-3">
                      <img
                        v-if="p.images[0]"
                        :src="p.images[0].urls.thumb"
                        :alt="p.images[0].alt ?? ''"
                        class="size-12 shrink-0 rounded-lg border border-slate-100 object-cover"
                        loading="lazy"
                      />
                      <span
                        v-else
                        class="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300"
                      >
                        <AppIcon name="products" :size="22" />
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate font-medium hover:text-brand-600">{{ p.title }}</span>
                        <span class="tech block truncate text-xs text-slate-400">{{ p.slug }}</span>
                      </span>
                    </NuxtLink>
                  </td>
                  <td class="px-4 py-3"><StatusBadge :status="p.status" /></td>
                  <td class="px-4 py-3 text-slate-600">{{ p.category?.name ?? '—' }}</td>
                  <td class="whitespace-nowrap px-4 py-3">{{ formatPriceRange(p.minPrice, p.maxPrice) }}</td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <span
                      class="badge"
                      :class="
                        !p.inStock
                          ? 'bg-red-100 text-red-700'
                          : totalStock(p) <= LOW_STOCK
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      "
                    >
                      {{ !p.inStock ? 'ناموجود' : totalStock(p) <= LOW_STOCK ? 'کم‌موجود' : 'موجود' }}
                    </span>
                    <span class="ms-2 text-xs text-slate-500">{{ formatNumber(totalStock(p)) }} عدد</span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-end">
                    <NuxtLink
                      :to="`/products/${p.id}`"
                      class="btn btn-ghost btn-sm !px-2"
                      title="ویرایش"
                      :aria-label="`ویرایش ${p.title}`"
                    >
                      <AppIcon name="edit" :size="16" />
                    </NuxtLink>
                    <button
                      v-if="canDelete"
                      type="button"
                      class="btn btn-ghost btn-sm !px-2 text-red-600 hover:!bg-red-50"
                      title="حذف"
                      :aria-label="`حذف ${p.title}`"
                      @click="remove(p)"
                    >
                      <AppIcon name="trash" :size="16" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- کارت (موبایل) -->
          <ul class="space-y-3 md:hidden">
            <li v-for="p in data.items" :key="p.id" class="card !p-3">
              <NuxtLink :to="`/products/${p.id}`" class="flex items-center gap-3">
                <img
                  v-if="p.images[0]"
                  :src="p.images[0].urls.thumb"
                  :alt="p.images[0].alt ?? ''"
                  class="size-16 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
                <span v-else class="grid size-16 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                  <AppIcon name="products" :size="24" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{ p.title }}</span>
                  <span class="mt-0.5 block text-sm text-slate-600">
                    {{ formatPriceRange(p.minPrice, p.maxPrice) }}
                  </span>
                  <span class="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge :status="p.status" />
                    <span class="text-xs" :class="p.inStock ? 'text-slate-500' : 'text-red-600'">
                      {{ p.inStock ? `${formatNumber(totalStock(p))} عدد` : 'ناموجود' }}
                    </span>
                  </span>
                </span>
              </NuxtLink>
              <div v-if="canDelete" class="mt-2 border-t border-slate-100 pt-2 text-end">
                <button type="button" class="btn btn-ghost btn-sm text-red-600" @click="remove(p)">
                  <AppIcon name="trash" :size="14" />
                  حذف
                </button>
              </div>
            </li>
          </ul>
        </div>

        <AppPagination :meta="data.meta" @change="(n) => setQuery({ page: n === 1 ? undefined : n })" />
      </template>
    </template>
  </div>
</template>
