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

const initial = computed(() => [...(customer.value?.name?.trim() || customer.value?.phone || '?')][0]);

async function onLogout() {
  await logout();
  await navigateTo('/');
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <h1 class="text-2xl font-extrabold sm:text-3xl">حساب من</h1>

    <div v-if="customer" class="space-y-6">
      <section class="card flex items-center gap-4">
        <span class="grid size-16 shrink-0 place-items-center rounded-full bg-brand-600 text-2xl font-extrabold text-on-brand">
          {{ initial }}
        </span>
        <div class="min-w-0">
          <div class="truncate text-lg font-bold">{{ customer.name || 'نام شما ثبت نشده' }}</div>
          <div class="text-sm text-slate-500" dir="ltr">{{ customer.phone }}</div>
        </div>
      </section>

      <div class="grid gap-3 sm:grid-cols-2">
        <NuxtLink to="/orders" class="card flex items-center gap-3 !p-4 transition hover:border-brand-500">
          <span class="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <StoreIcon name="orders" :size="22" />
          </span>
          <span>
            <span class="block font-bold">سفارش‌های من</span>
            <span class="block text-xs text-slate-500">پیگیری و مشاهده‌ی خریدها</span>
          </span>
        </NuxtLink>
        <NuxtLink to="/cart" class="card flex items-center gap-3 !p-4 transition hover:border-brand-500">
          <span class="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <StoreIcon name="cart" :size="22" />
          </span>
          <span>
            <span class="block font-bold">سبد خرید</span>
            <span class="block text-xs text-slate-500">ادامه‌ی خرید</span>
          </span>
        </NuxtLink>
      </div>

      <section class="card space-y-4">
        <h2 class="text-lg font-bold">اطلاعات حساب</h2>
        <form class="space-y-3" novalidate @submit.prevent="save">
          <label class="block">
            <span class="label">نام و نام خانوادگی</span>
            <input v-model="name" maxlength="60" class="input" autocomplete="name" />
          </label>
          <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>
          <p v-if="message" class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
            {{ message }}
          </p>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'در حال ذخیره…' : 'ذخیره' }}
          </button>
        </form>
      </section>

      <button
        type="button"
        class="btn btn-ghost w-full text-red-600 hover:!bg-red-50 sm:w-auto"
        @click="onLogout"
      >
        <StoreIcon name="logout" :size="18" />
        خروج از حساب
      </button>
    </div>

    <div v-else class="space-y-4" aria-busy="true">
      <div class="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      <div class="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  </div>
</template>
