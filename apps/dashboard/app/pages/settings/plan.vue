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
  <div class="max-w-5xl space-y-6">
    <PageHeader title="تنظیمات" subtitle="ظاهر و اطلاعات فروشگاه، پرداخت، دامنه و پلن" />
    <SettingsTabs />

    <p v-if="error" class="alert-error">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="data">
      <section class="card flex flex-wrap items-center justify-between gap-4 overflow-hidden !p-0">
        <div class="flex-1 bg-gradient-to-l from-brand-600 to-brand-800 p-6 text-white">
          <div class="flex items-center gap-2 text-sm text-brand-100">
            <AppIcon name="sparkle" :size="16" />
            پلن فعلی
          </div>
          <div class="mt-1 text-3xl font-extrabold">{{ data.plan.name }}</div>
          <div v-if="data.plan.priceMonthly" class="mt-1 text-sm text-brand-100">
            {{ formatPrice(data.plan.priceMonthly) }} در ماه
          </div>
        </div>
      </section>

      <p v-if="nearLimit" class="alert-warn !p-4">
        مصرف شما به سقف پلن نزدیک است. برای ارتقا با پشتیبانی تماس بگیرید.
      </p>

      <div class="grid gap-4 sm:grid-cols-3">
        <section v-for="r in rows" :key="r.label" class="card space-y-3 !p-5">
          <div class="text-sm font-medium text-slate-500">{{ r.label }}</div>
          <div>
            <span class="text-2xl font-extrabold">{{ r.text }}</span>
            <span class="text-sm text-slate-500">
              از {{ r.limit === null ? 'نامحدود' : formatNumber(r.limit) }}
              <template v-if="r.unit && r.limit !== null"> {{ r.unit }}</template>
            </span>
          </div>
          <div
            v-if="r.limit !== null"
            class="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            :aria-label="r.label"
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
          <p v-else-if="r.limit !== null" class="text-xs text-slate-500">{{ formatNumber(r.percent) }}٪ مصرف شده</p>
        </section>
      </div>

      <p class="hint">
        با کاهش پلن، محصولات و دامنه‌های موجود حذف نمی‌شوند؛ فقط ساخت مورد جدید تا زیر سقف‌رفتن مسدود است.
      </p>
    </template>
  </div>
</template>
