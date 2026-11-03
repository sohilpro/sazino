<script setup lang="ts">
definePageMeta({ layout: 'auth' });
useHead({ title: 'ورود مدیر پلتفرم' });

const auth = useAdminAuth();
const route = useRoute();
const isDev = import.meta.dev;

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const redirectTo = computed(() => {
  const v = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect;
  return typeof v === 'string' && v.startsWith('/admin') && !v.startsWith('//') ? v : '/admin';
});

onMounted(async () => {
  if (!auth.loaded.value) await auth.load();
  if (auth.admin.value) await navigateTo(redirectTo.value, { replace: true });
});

async function submit() {
  error.value = '';
  if (!email.value.trim() || !password.value) return void (error.value = 'ایمیل و رمز عبور را وارد کنید');

  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    await navigateTo(redirectTo.value);
  } catch (e) {
    error.value = apiErrorMessage(e, 'ورود ناموفق بود');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h1 class="mb-1 text-2xl font-extrabold">ورود مدیر پلتفرم</h1>
    <p class="mb-6 text-sm text-slate-500">این بخش فقط برای مدیران پلتفرم است.</p>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <label class="block">
        <span class="label">ایمیل</span>
        <input v-model="email" type="email" class="input tech" autocomplete="username" />
      </label>
      <label class="block">
        <span class="label">رمز عبور</span>
        <input v-model="password" type="password" class="input tech" autocomplete="current-password" />
      </label>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>

      <button type="submit" class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? 'در حال ورود…' : 'ورود' }}
      </button>
    </form>

    <p v-if="isDev" class="tech mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
      dev: admin@platform.test / AdminPass-12345
    </p>
  </div>
</template>