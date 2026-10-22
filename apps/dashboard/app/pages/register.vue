<script setup lang="ts">
import type { SubdomainAvailability } from '@myapp/shared-types';

definePageMeta({ layout: 'auth' });
useHead({ title: 'ثبت‌نام' });

const auth = useAuth();
const api = useApi();
const config = useRuntimeConfig();

const SUBDOMAIN_RE = /^(?!.*--)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const form = reactive({ storeName: '', subdomain: '', name: '', email: '', password: '' });
const loading = ref(false);
const error = ref('');

type SubState = 'idle' | 'checking' | 'ok' | 'invalid' | 'reserved' | 'taken';
const subState = ref<SubState>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;

const subMessage: Record<SubState, string> = {
  idle: '',
  checking: 'در حال بررسی…',
  ok: 'این آدرس آزاد است ✓',
  invalid: 'فقط حروف انگلیسی کوچک، عدد و خط تیره (۳ تا ۳۰ کاراکتر)',
  reserved: 'این آدرس رزرو شده است',
  taken: 'این آدرس قبلاً گرفته شده است',
};

function onSubdomainInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const clean = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (el.value !== clean) el.value = clean;
  form.subdomain = clean;
}

watch(
  () => form.subdomain,
  (value) => {
    clearTimeout(timer);
    if (!value) {
      subState.value = 'idle';
      return;
    }
    subState.value = 'checking';
    timer = setTimeout(async () => {
      try {
        const res = await api<SubdomainAvailability>('/auth/check-subdomain', {
          query: { subdomain: value },
        });
        if (form.subdomain === value) subState.value = res.available ? 'ok' : (res.reason ?? 'invalid');
      } catch {
        if (form.subdomain === value) subState.value = 'idle';
      }
    }, 400);
  },
);

onBeforeUnmount(() => clearTimeout(timer));

function validate(): string | null {
  if (form.storeName.trim().length < 2) return 'نام فروشگاه باید حداقل ۲ کاراکتر باشد';
  if (!SUBDOMAIN_RE.test(form.subdomain)) return subMessage.invalid;
  if (subState.value === 'taken' || subState.value === 'reserved') return subMessage[subState.value];
  if (form.name.trim().length < 2) return 'نام شما باید حداقل ۲ کاراکتر باشد';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'ایمیل معتبر نیست';
  if (form.password.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
  if (new TextEncoder().encode(form.password).length > 72) return 'رمز عبور بیش از حد طولانی است';
  return null;
}

async function submit() {
  error.value = validate() ?? '';
  if (error.value) return;

  loading.value = true;
  try {
    await auth.register({
      storeName: form.storeName.trim(),
      subdomain: form.subdomain,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    await navigateTo('/');
  } catch (e) {
    error.value = apiErrorMessage(e, 'ثبت‌نام ناموفق بود');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="card">
    <h1 class="mb-1 text-2xl font-extrabold">ساخت فروشگاه</h1>
    <p class="mb-6 text-sm text-slate-500">در چند ثانیه فروشگاه خودتان را بسازید.</p>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <label class="block">
        <span class="label">نام فروشگاه</span>
        <input v-model="form.storeName" class="input" maxlength="60" />
      </label>

      <label class="block">
        <span class="label">آدرس فروشگاه</span>
        <input
          :value="form.subdomain"
          dir="ltr"
          class="input"
          maxlength="30"
          placeholder="my-shop"
          @input="onSubdomainInput"
        />
        <span class="mt-1 block text-xs text-slate-500" dir="ltr">
          {{ form.subdomain || 'my-shop' }}.{{ config.public.platformDomain }}
        </span>
        <span
          v-if="subState !== 'idle'"
          class="mt-1 block text-xs"
          :class="subState === 'ok' ? 'text-emerald-600' : subState === 'checking' ? 'text-slate-500' : 'text-red-600'"
        >
          {{ subMessage[subState] }}
        </span>
      </label>

      <label class="block">
        <span class="label">نام شما</span>
        <input v-model="form.name" class="input" maxlength="60" autocomplete="name" />
      </label>

      <label class="block">
        <span class="label">ایمیل</span>
        <input v-model="form.email" type="email" dir="ltr" class="input" autocomplete="email" />
      </label>

      <label class="block">
        <span class="label">رمز عبور (حداقل ۸ کاراکتر)</span>
        <input
          v-model="form.password"
          type="password"
          dir="ltr"
          class="input"
          autocomplete="new-password"
        />
      </label>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {{ error }}
      </p>

      <button type="submit" class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? 'در حال ساخت…' : 'ساخت فروشگاه' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      حساب دارید؟
      <NuxtLink to="/login" class="text-brand-600 hover:underline">ورود</NuxtLink>
    </p>
  </div>
</template>