<script setup lang="ts">
const { admin, logout } = useAdminAuth();

const links = [
  { to: '/admin', label: 'نمای کلی', exact: true },
  { to: '/admin/tenants', label: 'فروشگاه‌ها', exact: false },
  { to: '/admin/plans', label: 'پلن‌ها', exact: false },
];
const activeClass = 'bg-slate-700 text-white';
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <header class="bg-slate-900 text-slate-200">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div class="flex flex-wrap items-center gap-4">
          <span class="font-extrabold text-white">مدیریت پلتفرم</span>
          <nav class="flex gap-1 text-sm">
            <NuxtLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              class="rounded-lg px-3 py-1.5 hover:bg-slate-800"
              :active-class="l.exact ? '' : activeClass"
              :exact-active-class="activeClass"
            >
              {{ l.label }}
            </NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <span class="tech text-slate-400">{{ admin?.email }}</span>
          <button type="button" class="rounded-lg border border-slate-600 px-3 py-1 hover:bg-slate-800" @click="logout">
            خروج
          </button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>