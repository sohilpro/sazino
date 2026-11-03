<script setup lang="ts">
import type { PlanUsageDto } from '@myapp/shared-types';

useHead({ title: 'پلن و مصرف' });

const api = useApi();
const { data, error } = await useAsyncData('plan-usage', () => api<PlanUsageDto>('/plan'));

const MB = 1024 * 1024;

const rows = computed(() => {
  const d = data.value;
  if (!d) return [];
  const mediaMb = d.usage.mediaBytes / MB;
  return [
    { label: 'محصولات', used: d.usage.products, limit: d.plan.maxProducts, unit: '', text: formatNumber(d.usage.products) },
    { label: 'دامنه‌ی اختصاصی', used: d.usage.domains, limit: d.plan.maxDomains, unit: '', text: formatNumber(d.usage.domains) },
    {
      label: 'فضای تصاویر',
      used: mediaMb,
      limit: d.plan.maxMediaMb,
      unit: 'مگابایت',
      text: formatNumber(Math.round(mediaMb * 10) / 10),
    },
  ].map((r) => ({ ...r, percent: r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0 }));
});

const nearLimit = computed(() => rows.value.some((r) => r.limit !== null && r.limit > 0 && r.percent >= 80));
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-extrabold">پلن و مصرف</h1>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="data">
      <section class="card flex items-center justify-between gap-3">
        <div>
          <div class="text-sm text-slate-500">پلن فعلی</div>
          <div class="text-2xl font-extrabold text-brand-600">{{ data.plan.name }}</div>
        </div>
        <div v-if="data.plan.priceMonthly" class="text-end text-sm text-slate-600">
          {{ formatPrice(data.plan.priceMonthly) }} در ماه
        </div>
      </section>

      <section class="card space-y-5">
        <div v-for="r in rows" :key="r.label" class="space-y-1">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium">{{ r.label }}</span>
            <span class="text-slate-600">
              {{ r.text }} از
              {{ r.limit === null ? 'نامحدود' : formatNumber(r.limit) }}
              <template v-if="r.unit && r.limit !== null"> {{ r.unit }}</template>
            </span>
          </div>
          <div
            v-if="r.limit !== null"
            class="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            :aria-valuenow="r.percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full rounded-full transition-all"
              :class="r.percent >= 100 ? 'bg-red-500' : r.percent >= 80 ? 'bg-amber-500' : 'bg-brand-500'"
              :style="{ width: `${r.limit === 0 ? 100 : r.percent}%` }"
            />
          </div>
          <p v-if="r.limit === 0" class="text-xs text-amber-700">این امکان در پلن فعلی شما نیست.</p>
        </div>
      </section>

      <p v-if="nearLimit" class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
        مصرف شما به سقف پلن نزدیک است. برای ارتقا با پشتیبانی تماس بگیرید.
      </p>
      <p class="text-xs text-slate-500">
        با کاهش پلن، محصولات و دامنه‌های موجود حذف نمی‌شوند؛ فقط ساخت مورد جدید تا زیر سقف‌رفتن مسدود است.
      </p>
    </template>
  </div>
</template>