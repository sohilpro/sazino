<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="text-xl font-extrabold text-brand-600">فروشگاه</NuxtLink>
        <nav class="flex gap-6 text-sm text-slate-600">
          <NuxtLink to="/" class="hover:text-brand-600">خانه</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-10">
      <slot />
    </main>

    <footer class="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
      ساخته‌شده با پلتفرم فروشگاه‌ساز
    </footer>
  </div>
</template>