<script setup lang="ts">
import type { PlanDto } from '@myapp/shared-types';

definePageMeta({ layout: 'admin', middleware: 'admin-auth' });
useHead({ title: 'پلن‌ها | مدیریت پلتفرم' });

const api = useAdminApi();
const toast = useToast();

interface Row {
  key: PlanDto['key'];
  name: string;
  priceMonthly: string;
  maxProducts: string;
  maxDomains: string;
  maxMediaMb: string;
  saving: boolean;
}

const { data, error } = await useAsyncData('admin-plans', () => api<PlanDto[]>('/admin/plans'));

const toText = (v: number | null) => (v === null ? '' : String(v));
const rows = ref<Row[]>(
  (data.value ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    priceMonthly: String(p.priceMonthly),
    maxProducts: toText(p.maxProducts),
    maxDomains: toText(p.maxDomains),
    maxMediaMb: toText(p.maxMediaMb),
    saving: false,
  })),
);

/** خالی = نامحدود */
function limit(raw: string): number | null | typeof Number.NaN {
  const value = parseIntField(raw);
  return value === null ? null : value;
}

async function save(row: Row) {
  const body = {
    name: row.name.trim(),
    priceMonthly: parseIntField(row.priceMonthly) ?? 0,
    maxProducts: limit(row.maxProducts),
    maxDomains: limit(row.maxDomains),
    maxMediaMb: limit(row.maxMediaMb),
  };
  if ([body.priceMonthly, body.maxProducts, body.maxDomains, body.maxMediaMb].some((v) => Number.isNaN(v))) {
    return void toast.error('مقدارها باید عدد صحیح نامنفی باشند (خالی = نامحدود)');
  }
  if (body.name.length < 2) return void toast.error('نام پلن حداقل ۲ کاراکتر است');

  row.saving = true;
  try {
    await api(`/admin/plans/${row.key}`, { method: 'PUT', body });
    toast.success(`پلن «${body.name}» ذخیره شد`);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    row.saving = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-extrabold">پلن‌ها</h1>
      <p class="text-sm text-slate-500">
        خالی‌گذاشتن یک سقف یعنی نامحدود. تغییر سقف بلافاصله اعمال می‌شود؛ داده‌ی موجود هیچ فروشگاهی حذف نمی‌شود.
      </p>
    </header>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <form v-for="row in rows" :key="row.key" class="card space-y-4" novalidate @submit.prevent="save(row)">
      <div class="flex items-center justify-between">
        <h2 class="tech text-lg font-bold">{{ row.key }}</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label class="block lg:col-span-1">
          <span class="label">نام</span>
          <input v-model="row.name" class="input" maxlength="40" />
        </label>
        <label class="block">
          <span class="label">قیمت ماهانه (تومان)</span>
          <input v-model="row.priceMonthly" class="input tech" inputmode="numeric" />
        </label>
        <label class="block">
          <span class="label">سقف محصول</span>
          <input v-model="row.maxProducts" class="input tech" inputmode="numeric" placeholder="نامحدود" />
        </label>
        <label class="block">
          <span class="label">سقف دامنه</span>
          <input v-model="row.maxDomains" class="input tech" inputmode="numeric" placeholder="نامحدود" />
        </label>
        <label class="block">
          <span class="label">سقف فضا (مگابایت)</span>
          <input v-model="row.maxMediaMb" class="input tech" inputmode="numeric" placeholder="نامحدود" />
        </label>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="row.saving">
        {{ row.saving ? 'در حال ذخیره…' : 'ذخیره' }}
      </button>
    </form>
  </div>
</template>