<script setup lang="ts">
import type { IconName } from '~/components/AppIcon.vue';

const route = useRoute();

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/settings/theme', label: 'ظاهر فروشگاه', icon: 'theme' },
  { to: '/settings/payment', label: 'درگاه پرداخت', icon: 'payment' },
  { to: '/settings/domains', label: 'دامنه‌ی اختصاصی', icon: 'domain' },
  { to: '/settings/plan', label: 'پلن و مصرف', icon: 'plan' },
];
</script>

<template>
  <nav class="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="تنظیمات">
    <NuxtLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition"
      :class="
        route.path === t.to
          ? 'border-brand-600 font-semibold text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      "
    >
      <AppIcon :name="t.icon" :size="16" />
      {{ t.label }}
    </NuxtLink>
  </nav>
</template>
