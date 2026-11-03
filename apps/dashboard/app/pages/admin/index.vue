<script setup lang="ts">
import type { AdminStatsDto } from '@myapp/shared-types';

definePageMeta({ layout: 'admin', middleware: 'admin-auth' });
useHead({ title: 'نمای کلی | مدیریت پلتفرم' });

const api = useAdminApi();
const { data: stats, error } = await useAsyncData('admin-stats', () =>
  api<AdminStatsDto>('/admin/stats'),
);

const PLAN_LABEL = { FREE: 'رایگان', BASIC: 'پایه', PRO: 'حرفه‌ای' } as const;
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-extrabold">نمای کلی</h1>
    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="stats">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <NuxtLink to="/admin/tenants?status=ACTIVE" class="card transition hover:border-brand-500">
          <div class="text-sm text-slate-500">فروشگاه فعال</div>
          <div class="text-3xl font-extrabold text-emerald-600">
            {{ formatNumber(stats.tenants.ACTIVE) }}
          </div>
        </NuxtLink>
        <NuxtLink
          to="/admin/tenants?status=SUSPENDED"
          class="card transition hover:border-brand-500"
        >
          <div class="text-sm text-slate-500">تعلیق‌شده</div>
          <div class="text-3xl font-extrabold text-red-600">
            {{ formatNumber(stats.tenants.SUSPENDED) }}
          </div>
        </NuxtLink>
        <NuxtLink
          v-for="(label, key) in PLAN_LABEL"
          :key="key"
          :to="`/admin/tenants?plan=${key}`"
          class="card transition hover:border-brand-500"
        >
          <div class="text-sm text-slate-500">پلن {{ label }}</div>
          <div class="text-3xl font-extrabold">{{ formatNumber(stats.byPlan[key]) }}</div>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
