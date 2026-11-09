<script setup lang="ts">
import type { HealthResponse, ServiceCheck } from '@myapp/shared-types';

const config = useRuntimeConfig();

const { data, error, status, refresh } = await useFetch<HealthResponse>('/health', {
  baseURL: config.public.apiBase,
  key: 'api-health',
  server: false,
  lazy: true,
});

// وقتی API وضعیت degraded دارد، بدنه‌ی 503 داخل error.data است
const health = computed(() => data.value ?? (error.value?.data as HealthResponse | undefined));

const labels: Record<string, string> = {
  database: 'پستگرس',
  redis: 'ردیس',
  storage: 'MinIO',
  worker: 'Worker (پیامک و نگهداری)',
};

// worker فقط وقتی در پاسخ هست که API آن را بسنجد؛ مقدارهای تعریف‌نشده حذف می‌شوند
const entries = computed(() => {
  const checks: Partial<Record<string, ServiceCheck>> = health.value?.checks ?? {};
  return Object.entries(checks).flatMap(([name, check]) => (check ? [{ name, check }] : []));
});
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold">وضعیت سرویس‌ها</h2>
      <button
        class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white transition hover:bg-brand-700"
        @click="() => refresh()"
      >
        بروزرسانی
      </button>
    </div>

    <p v-if="status === 'pending' && !health" class="text-slate-500">در حال بررسی…</p>

    <p v-else-if="!health" class="text-red-600">
      ارتباط با API برقرار نشد. مطمئن شوید API روی پورت ۴۰۰۰ اجرا است.
    </p>

    <template v-else>
      <ul class="space-y-2">
        <li
          v-for="item in entries"
          :key="item.name"
          class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
        >
          <span>{{ labels[item.name] ?? item.name }}</span>
          <span class="flex items-center gap-2 text-sm text-slate-600">
            <span
              class="size-2.5 rounded-full"
              :class="item.check.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ item.check.latencyMs }}ms
          </span>
        </li>
      </ul>
      <p class="mt-3 text-xs text-slate-400" dir="ltr">version: {{ health.version }}</p>
    </template>
  </section>
</template>