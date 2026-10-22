<script setup lang="ts">
definePageMeta({ layout: 'auth' });
useHead({ title: 'ورود' });

const auth = useAuth();
const route = useRoute();
const isDev = import.meta.dev;

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

/** فقط مسیرهای داخلی پذیرفته می‌شود (جلوگیری از open redirect) */
function safeRedirect(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/';
}

async function submit() {
  error.value = '';
  if (!email.value.trim() || !password.value) {
    error.value = 'ایمیل و رمز عبور را وارد کنید';
    return;
  }
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    await navigateTo(safeRedirect(route.query.redirect));
  } catch (e) {
    error.value = apiErrorMessage(e, 'ورود ناموفق بود');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h1 class="mb-1 text-2xl font-extrabold">ورود به پنل فروشنده</h1>
    <p class="mb-6 text-sm text-slate-500">برای مدیریت فروشگاه خود وارد شوید.</p>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <label class="block">
        <span class="label">ایمیل</span>
        <input v-model="email" type="email" dir="ltr" class="input" autocomplete="username" />
      </label>
      <label class="block">
        <span class="label">رمز عبور</span>
        <input
          v-model="password"
          type="password"
          dir="ltr"
          class="input"
          autocomplete="current-password"
        />
      </label>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {{ error }}
      </p>

      <button type="submit" class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? 'در حال ورود…' : 'ورود' }}
      </button>
    </form>

    <p v-if="isDev" class="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500" dir="ltr">
      dev: owner@demo.test / Password123!
    </p>

    <p class="mt-6 text-center text-sm text-slate-500">
      فروشگاه ندارید؟
      <NuxtLink to="/register" class="text-brand-600 hover:underline">ثبت‌نام</NuxtLink>
    </p>
  </div>
</template>