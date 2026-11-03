<script setup lang="ts">
import type { AdminTenantDetailDto, PlanDto, TenantPlan } from '@myapp/shared-types';

definePageMeta({ layout: 'admin', middleware: 'admin-auth' });

const route = useRoute();
const api = useAdminApi();
const toast = useToast();

const id = String(route.params.id);
if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, fatal: true });

const { data: tenant, error } = await useAsyncData(`admin-tenant-${id}`, () =>
  api<AdminTenantDetailDto>(`/admin/tenants/${id}`),
);
const { data: plans } = await useAsyncData('admin-plans-options', () => api<PlanDto[]>('/admin/plans'));
useHead({ title: () => `${tenant.value?.name ?? 'فروشگاه'} | مدیریت پلتفرم` });

const reason = ref('');
const planChoice = ref<TenantPlan>(tenant.value?.plan ?? 'FREE');
const busy = ref(false);

const MB = 1024 * 1024;
const ACTION_LABEL: Record<string, string> = {
  'tenant.suspend': 'تعلیق',
  'tenant.activate': 'فعال‌سازی',
  'tenant.plan': 'تغییر پلن',
};

const usageRows = computed(() => {
  const t = tenant.value;
  if (!t) return [];
  return [
    { label: 'محصولات', text: formatNumber(t.usage.products), limit: t.planInfo.maxProducts, used: t.usage.products },
    { label: 'دامنه‌ها', text: formatNumber(t.usage.domains), limit: t.planInfo.maxDomains, used: t.usage.domains },
    {
      label: 'فضای تصاویر (مگابایت)',
      text: formatNumber(Math.round((t.usage.mediaBytes / MB) * 10) / 10),
      limit: t.planInfo.maxMediaMb,
      used: t.usage.mediaBytes / MB,
    },
  ];
});

async function act(path: string, method: 'POST' | 'PUT', body: Record<string, unknown>, ok: string) {
  busy.value = true;
  try {
    tenant.value = await api<AdminTenantDetailDto>(`/admin/tenants/${id}/${path}`, { method, body });
    planChoice.value = tenant.value.plan;
    toast.success(ok);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    busy.value = false;
  }
}

async function suspend() {
  const text = reason.value.trim();
  if (text.length < 3) return void toast.error('دلیل تعلیق را بنویسید (حداقل ۳ کاراکتر)');
  if (!confirm('فروشگاه فوراً تعلیق شود؟ ویترین و پنل آن بلافاصله از دسترس خارج می‌شوند.')) return;
  await act('suspend', 'POST', { reason: text }, 'فروشگاه تعلیق شد');
  reason.value = '';
}

const activate = () => act('activate', 'POST', {}, 'فروشگاه فعال شد');

async function changePlan() {
  if (planChoice.value === tenant.value?.plan) return;
  if (!confirm('پلن این فروشگاه عوض شود؟')) return;
  await act('plan', 'PUT', { plan: planChoice.value }, 'پلن تغییر کرد');
}
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <NuxtLink to="/admin/tenants" class="text-sm text-slate-500 hover:text-brand-600">→ فروشگاه‌ها</NuxtLink>

    <p v-if="error" class="card text-red-700">
      {{ statusOf(error) === 404 ? 'فروشگاه پیدا نشد.' : apiErrorMessage(error) }}
    </p>

    <template v-else-if="tenant">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold">{{ tenant.name }}</h1>
          <div class="tech text-sm text-slate-500">{{ tenant.subdomain }} · {{ tenant.ownerEmail ?? '—' }}</div>
        </div>
        <span class="badge" :class="tenant.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
          {{ tenant.status === 'ACTIVE' ? 'فعال' : 'تعلیق‌شده' }}
        </span>
      </header>

      <!-- وضعیت -->
      <section class="card space-y-3">
        <h2 class="text-lg font-bold">وضعیت</h2>

        <template v-if="tenant.status === 'ACTIVE'">
          <label class="block">
            <span class="label">دلیل تعلیق (ثبت می‌شود)</span>
            <textarea v-model="reason" rows="2" class="input" maxlength="300" />
          </label>
          <button type="button" class="btn btn-danger" :disabled="busy" @click="suspend">تعلیق فروشگاه</button>
        </template>

        <template v-else>
          <p class="text-sm text-slate-600">
            تعلیق‌شده در {{ tenant.suspendedAt ? formatDateTime(tenant.suspendedAt) : '' }}
            <span v-if="tenant.suspendedReason" class="block text-slate-500">دلیل: {{ tenant.suspendedReason }}</span>
          </p>
          <button type="button" class="btn btn-primary" :disabled="busy" @click="activate">فعال‌سازی</button>
        </template>
      </section>

      <!-- پلن و مصرف -->
      <section class="card space-y-4">
        <h2 class="text-lg font-bold">پلن و مصرف</h2>
        <div class="flex flex-wrap items-end gap-3">
          <label>
            <span class="label">پلن</span>
            <select v-model="planChoice" class="input">
              <option v-for="p in plans" :key="p.key" :value="p.key">{{ p.name }}</option>
            </select>
          </label>
          <button type="button" class="btn btn-secondary" :disabled="busy || planChoice === tenant.plan" @click="changePlan">
            ثبت پلن
          </button>
        </div>

        <ul class="space-y-3">
          <li v-for="r in usageRows" :key="r.label" class="text-sm">
            <div class="flex justify-between">
              <span>{{ r.label }}</span>
              <span class="text-slate-600">{{ r.text }} از {{ r.limit === null ? 'نامحدود' : formatNumber(r.limit) }}</span>
            </div>
            <div v-if="r.limit" class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full"
                :class="r.used >= r.limit ? 'bg-red-500' : 'bg-brand-500'"
                :style="{ width: `${Math.min(100, Math.round((r.used / r.limit) * 100))}%` }"
              />
            </div>
          </li>
        </ul>
      </section>

      <div class="grid gap-6 md:grid-cols-2">
        <section class="card space-y-2">
          <h2 class="text-lg font-bold">تیم</h2>
          <ul class="divide-y divide-slate-100 text-sm">
            <li v-for="u in tenant.staff" :key="u.id" class="flex items-center justify-between py-2">
              <span>
                {{ u.name }}
                <span class="tech block text-xs text-slate-400">{{ u.email }}</span>
              </span>
              <span class="text-xs text-slate-500">
                {{ ROLE_LABEL[u.role] }}{{ u.isActive ? '' : ' · غیرفعال' }}
              </span>
            </li>
          </ul>
        </section>

        <section class="card space-y-2">
          <h2 class="text-lg font-bold">دامنه‌ها</h2>
          <p v-if="!tenant.domains.length" class="text-sm text-slate-500">دامنه‌ای ندارد.</p>
          <ul v-else class="divide-y divide-slate-100 text-sm">
            <li v-for="d in tenant.domains" :key="d.hostname" class="flex items-center justify-between py-2">
              <span class="tech">{{ d.hostname }}</span>
              <span class="text-xs text-slate-500">
                {{ d.status === 'VERIFIED' ? 'فعال' : d.status === 'PENDING' ? 'در انتظار' : 'غیرفعال' }}{{ d.isPrimary ? ' · اصلی' : '' }}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section class="card space-y-2">
        <h2 class="text-lg font-bold">تاریخچه‌ی اقدامات</h2>
        <p v-if="!tenant.audit.length" class="text-sm text-slate-500">هنوز اقدامی ثبت نشده است.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-for="a in tenant.audit" :key="a.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b>{{ ACTION_LABEL[a.action] ?? a.action }}</b>
              <span class="tech ms-2 text-xs text-slate-500">{{ a.adminEmail }}</span>
              <span v-if="a.details.reason" class="block text-xs text-slate-500">{{ a.details.reason }}</span>
              <span v-if="a.details.from" class="tech block text-xs text-slate-500">{{ a.details.from }} → {{ a.details.to }}</span>
            </span>
            <span class="text-xs text-slate-400">{{ formatDateTime(a.createdAt) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>