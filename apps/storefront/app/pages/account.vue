<script setup lang="ts">
useSeoMeta({ title: 'حساب من', robots: 'noindex, nofollow' });

const { customer, loaded, isLoggedIn, updateName, logout } = useCustomer();

// صفحه‌ی خصوصی: بعد از مشخص‌شدن وضعیت، مهمان به ورود می‌رود
watch(
  () => [loaded.value, isLoggedIn.value] as const,
  ([isLoaded, loggedIn]) => {
    if (isLoaded && !loggedIn) void navigateTo({ path: '/login', query: { redirect: '/account' } });
  },
  { immediate: true },
);

const name = ref('');
watch(
  customer,
  (c) => {
    name.value = c?.name ?? '';
  },
  { immediate: true },
);

const saving = ref(false);
const message = ref('');
const error = ref('');

async function save() {
  message.value = '';
  error.value = '';
  if (name.value.trim().length < 2) {
    error.value = 'نام باید حداقل ۲ کاراکتر باشد';
    return;
  }
  saving.value = true;
  try {
    await updateName(name.value.trim());
    message.value = 'ذخیره شد.';
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function onLogout() {
  await logout();
  await navigateTo('/');
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <h1 class="text-2xl font-extrabold">حساب من</h1>

    <div
      v-if="customer"
      class="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <div class="text-sm text-slate-500">شماره‌ی موبایل</div>
        <div class="font-medium" dir="ltr">{{ customer.phone }}</div>
      </div>

      <form class="space-y-3" novalidate @submit.prevent="save">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">نام و نام خانوادگی</span>
          <input
            v-model="name"
            maxlength="60"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
        <p v-if="message" class="text-sm text-emerald-700" role="status">{{ message }}</p>
        <button type="submit" class="btn btn-primary" :disabled="saving">ذخیره</button>
      </form>

      <NuxtLink to="/orders" class="btn btn-secondary">سفارش‌های من</NuxtLink>

      <button type="button" class="btn btn-secondary" @click="onLogout">خروج از حساب</button>
    </div>
    <p v-else class="text-slate-500">در حال بارگذاری…</p>
  </div>
</template>
