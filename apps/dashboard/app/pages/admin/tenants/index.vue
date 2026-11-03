<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router';
import type { AdminTenantSummaryDto, Paginated } from '@myapp/shared-types';

definePageMeta({ layout: 'admin', middleware: 'admin-auth' });
useHead({ title: 'فروشگاه‌ها | مدیریت پلتفرم' });

const api = useAdminApi();
const route = useRoute();
const router = useRouter();

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const PLAN_LABEL = { FREE: 'رایگان', BASIC: 'پایه', PRO: 'حرفه‌ای' } as const;

const filters = computed(() => {
  const page = Math.floor(Number(route.query.page));
  const status = str(route.query.status);
  const plan = str(route.query.plan);
  return {
    page: page > 0 && page <= 100_000 ? page : 1,
    q: str(route.query.q).trim().slice(0, 100),
    status: status === 'ACTIVE' || status === 'SUSPENDED' ? status : '',
    plan: plan in PLAN_LABEL ? plan : '',
  };
});

const { data, error, status } = await useAsyncData(
  'admin-tenants',
  () => api<Paginated<AdminTenantSummaryDto>>('/admin/tenants', { query: { ...filters.value, limit: 20 } }),
  { watch: [filters] },
);

function setQuery(patch: Record<string, string | number | undefined>) {
  const next = { ...route.query, ...patch } as Record<string, unknown>;
  for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === '') delete next[key];
  void router.replace({ query: next as LocationQueryRaw });
}

const search = ref(filters.value.q);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => setQuery({ q: value.trim() || undefined, page: undefined }), 350);
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-extrabold">فروشگاه‌ها</h1>

    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <label class="min-w-56 flex-1">
        <span class="label">جستجو</span>
        <input v-model="search" class="input" placeholder="نام، ساب‌دامین یا ایمیل مالک" />
      </label>
      <label>
        <span class="label">وضعیت</span>
        <select class="input" :value="filters.status" @change="setQuery({ status: ($event.target as HTMLSelectElement).value, page: undefined })">
          <option value="">همه</option>
          <option value="ACTIVE">فعال</option>
          <option value="SUSPENDED">تعلیق‌شده</option>
        </select>
      </label>
      <label>
        <span class="label">پلن</span>
        <select class="input" :value="filters.plan" @change="setQuery({ plan: ($event.target as HTMLSelectElement).value, page: undefined })">
          <option value="">همه</option>
          <option v-for="(label, key) in PLAN_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="data">
      <p v-if="!data.items.length" class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        فروشگاهی پیدا نشد.
      </p>

      <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm transition" :class="status === 'pending' ? 'opacity-60' : ''">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 text-start font-medium">فروشگاه</th>
              <th class="px-4 py-3 text-start font-medium">مالک</th>
              <th class="px-4 py-3 text-start font-medium">پلن</th>
              <th class="px-4 py-3 text-start font-medium">وضعیت</th>
              <th class="px-4 py-3 text-start font-medium">محصول / سفارش / مشتری</th>
              <th class="px-4 py-3 text-start font-medium">ساخت</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in data.items" :key="t.id" class="hover:bg-slate-50">
              <td class="px-4 py-3">
                <NuxtLink :to="`/admin/tenants/${t.id}`" class="font-medium hover:text-brand-600">{{ t.name }}</NuxtLink>
                <div class="tech text-xs text-slate-400">{{ t.subdomain }}</div>
              </td>
              <td class="tech px-4 py-3 text-slate-600">{{ t.ownerEmail ?? '—' }}</td>
              <td class="px-4 py-3">{{ PLAN_LABEL[t.plan] }}</td>
              <td class="px-4 py-3">
                <span class="badge" :class="t.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                  {{ t.status === 'ACTIVE' ? 'فعال' : 'تعلیق‌شده' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatNumber(t.productCount) }} / {{ formatNumber(t.orderCount) }} / {{ formatNumber(t.customerCount) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500">{{ formatDate(t.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination :meta="data.meta" @change="(n) => setQuery({ page: n === 1 ? undefined : n })" />
    </template>
  </div>
</template>