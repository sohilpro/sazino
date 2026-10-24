<script setup lang="ts">
useSeoMeta({ title: 'ورود یا ثبت‌نام', robots: 'noindex, nofollow' });

const route = useRoute();
const { requestOtp, verify, isLoggedIn, loaded } = useCustomer();

const step = ref<'phone' | 'code'>('phone');
const phone = ref('');
const code = ref('');
const loading = ref(false);
const error = ref('');
const resendIn = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const redirectTo = computed(() => safeRedirect(route.query.redirect));

// اگر قبلاً وارد شده، همین‌جا نماند
watch(
  () => loaded.value && isLoggedIn.value,
  (loggedIn) => {
    if (loggedIn) void navigateTo(redirectTo.value, { replace: true });
  },
  { immediate: true },
);

function startCountdown(seconds: number) {
  clearInterval(timer);
  resendIn.value = seconds;
  timer = setInterval(() => {
    resendIn.value = Math.max(0, resendIn.value - 1);
    if (resendIn.value === 0) clearInterval(timer);
  }, 1000);
}
onBeforeUnmount(() => clearInterval(timer));

async function sendCode() {
  error.value = '';
  if (!phone.value.trim()) {
    error.value = 'شماره‌ی موبایل را وارد کنید';
    return;
  }
  loading.value = true;
  try {
    const res = await requestOtp(phone.value.trim());
    step.value = 'code';
    code.value = '';
    startCountdown(res.resendIn);
  } catch (e) {
    const wait = retryAfterOf(e);
    if (wait && statusOf(e) === 429 && step.value === 'phone') {
      // کد قبلی هنوز معتبر است؛ کاربر می‌تواند همان را وارد کند
      step.value = 'code';
      startCountdown(Math.min(wait, 60));
    }
    error.value = apiErrorMessage(e, 'ارسال کد ناموفق بود');
  } finally {
    loading.value = false;
  }
}

async function submitCode() {
  error.value = '';
  if (code.value.trim().length < 6) {
    error.value = 'کد ۶ رقمی را کامل وارد کنید';
    return;
  }
  loading.value = true;
  try {
    await verify(phone.value.trim(), code.value.trim());
    await navigateTo(redirectTo.value);
  } catch (e) {
    error.value = apiErrorMessage(e, 'ورود ناموفق بود');
  } finally {
    loading.value = false;
  }
}

function editPhone() {
  step.value = 'phone';
  error.value = '';
}
</script>

<template>
  <div class="mx-auto max-w-md">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="mb-1 text-2xl font-extrabold">ورود یا ثبت‌نام</h1>
      <p class="mb-6 text-sm text-slate-500">
        {{ step === 'phone' ? 'شماره‌ی موبایل خود را وارد کنید تا کد تأیید برایتان پیامک شود.' : `کد ۶ رقمی به ${phone} ارسال شد.` }}
      </p>

      <form v-if="step === 'phone'" class="space-y-4" novalidate @submit.prevent="sendCode">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">شماره‌ی موبایل</span>
          <input
            v-model="phone"
            type="tel"
            inputmode="tel"
            dir="ltr"
            autocomplete="tel"
            placeholder="09123456789"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          {{ loading ? 'در حال ارسال…' : 'دریافت کد تأیید' }}
        </button>
      </form>

      <form v-else class="space-y-4" novalidate @submit.prevent="submitCode">
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">کد تأیید</span>
          <input
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            dir="ltr"
            maxlength="6"
            placeholder="------"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-xl tracking-[0.5em] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          {{ loading ? 'در حال بررسی…' : 'ورود' }}
        </button>

        <div class="flex items-center justify-between text-sm">
          <button type="button" class="text-slate-500 hover:text-brand-700" @click="editPhone">
            ویرایش شماره
          </button>
          <button
            type="button"
            class="text-brand-700 disabled:text-slate-400"
            :disabled="resendIn > 0 || loading"
            @click="sendCode"
          >
            {{ resendIn > 0 ? `ارسال مجدد (${formatNumber(resendIn)})` : 'ارسال مجدد کد' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>