<script setup lang="ts">
const points = [
  'فروشگاه آنلاین خودتان را در چند دقیقه راه بیندازید',
  'قالب آماده، آدرس اختصاصی و درگاه پرداخت',
  'مدیریت سفارش‌ها و محصولات از یک پنل ساده',
];
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <aside
      class="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex"
    >
      <div
        class="pointer-events-none absolute -start-24 -top-24 size-96 rounded-full bg-brand-600/40 blur-3xl"
      />
      <div
        class="pointer-events-none absolute -bottom-32 -end-16 size-96 rounded-full bg-brand-400/20 blur-3xl"
      />
      <div class="relative text-2xl font-extrabold">ساز<span class="text-brand-400">ینو</span></div>
      <div class="relative">
        <h2 class="mb-8 text-3xl font-extrabold leading-snug">
          فروش آنلاین،<br />بدون دردسر فنی.
        </h2>
        <ul class="space-y-4 text-brand-100">
          <li v-for="p in points" :key="p" class="flex items-start gap-3">
            <span
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200"
            >
              <AppIcon name="check" :size="14" />
            </span>
            <span>{{ p }}</span>
          </li>
        </ul>
      </div>
      <div class="relative text-sm text-brand-200/70">پلتفرم فروشگاه‌ساز</div>
    </aside>

    <main class="flex items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center text-2xl font-extrabold text-brand-700 lg:hidden">سازینو</div>
        <slot />
      </div>
    </main>
  </div>
</template>
