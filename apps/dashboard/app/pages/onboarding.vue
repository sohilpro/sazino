<script setup lang="ts">
import type { Paginated, ProductDto, StoreSettingsDto } from '@myapp/shared-types';

definePageMeta({ layout: false });
useHead({ title: 'راه‌اندازی فروشگاه' });

const api = useApi();
const toast = useToast();
const { tenant } = useAuth();

const STEPS = ['ظاهر فروشگاه', 'اولین محصول', 'آماده‌ی فروش'] as const;
const step = ref(0);

const { data: settings } = await useAsyncData('onboarding-settings', () =>
  api<StoreSettingsDto>('/store-settings'),
);
const { data: productCount } = useLazyAsyncData(
  'onboarding-product-count',
  async () => (await api<Paginated<ProductDto>>('/products', { query: { limit: 1 } })).meta.total,
);

const form = reactive({
  name: settings.value?.name ?? tenant.value?.name ?? '',
  description: settings.value?.description ?? '',
  presetKey: LOOK_PRESETS.find((p) => p.primaryColor === settings.value?.primaryColor)?.key ?? 'indigo',
});
const preset = computed(() => LOOK_PRESETS.find((p) => p.key === form.presetKey) ?? LOOK_PRESETS[0]!);
const color = computed(() => preset.value.primaryColor);
const textOnColor = computed(() => contrastColor(color.value));

const nameError = computed(() =>
  form.name.trim().length < 2 ? 'نام فروشگاه باید حداقل ۲ کاراکتر باشد' : '',
);
const saving = ref(false);

async function saveLook() {
  if (nameError.value) return void toast.error(nameError.value);
  if (form.description.length > 500) return void toast.error('توضیح حداکثر ۵۰۰ کاراکتر است');
  saving.value = true;
  try {
    settings.value = await api<StoreSettingsDto>('/store-settings', {
      method: 'PUT',
      body: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        primaryColor: preset.value.primaryColor,
        font: preset.value.font,
        // لوگوی قبلی حفظ می‌شود؛ تغییرش از «ظاهر فروشگاه» است
        logoMediaId: settings.value?.logo?.id ?? null,
      },
    });
    step.value = 1;
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div class="text-lg font-extrabold text-brand-700">سازینو</div>
        <NuxtLink to="/" class="text-sm text-slate-500 hover:text-slate-800">بعداً انجام می‌دهم</NuxtLink>
      </div>
    </header>

    <div class="mx-auto max-w-5xl px-4 py-8">
      <!-- نوار مراحل -->
      <ol class="mb-8 flex items-center gap-2 sm:gap-4" aria-label="مراحل راه‌اندازی">
        <li v-for="(label, i) in STEPS" :key="label" class="flex flex-1 items-center gap-2">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition"
            :class="
              i < step
                ? 'bg-emerald-500 text-white'
                : i === step
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-200 text-slate-500'
            "
            :aria-current="i === step ? 'step' : undefined"
          >
            <AppIcon v-if="i < step" name="check" :size="16" />
            <template v-else>{{ formatNumber(i + 1) }}</template>
          </span>
          <span class="hidden text-sm sm:block" :class="i === step ? 'font-bold' : 'text-slate-500'">
            {{ label }}
          </span>
          <span v-if="i < STEPS.length - 1" class="h-px flex-1 bg-slate-200" />
        </li>
      </ol>

      <!-- مرحله ۱: ظاهر -->
      <section v-if="step === 0" class="grid gap-6 lg:grid-cols-5">
        <form class="card space-y-5 lg:col-span-3" novalidate @submit.prevent="saveLook">
          <div>
            <h1 class="page-title">ظاهر فروشگاهتان را انتخاب کنید</h1>
            <p class="mt-1 text-sm text-slate-500">بعداً هر زمان بخواهید می‌توانید تغییرش دهید.</p>
          </div>

          <fieldset>
            <legend class="label">سبک رنگی</legend>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label
                v-for="p in LOOK_PRESETS"
                :key="p.key"
                class="cursor-pointer rounded-xl border-2 p-3 transition"
                :class="form.presetKey === p.key ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'"
              >
                <input v-model="form.presetKey" type="radio" name="preset" :value="p.key" class="sr-only" />
                <span class="mb-2 block h-8 rounded-lg" :style="{ background: p.primaryColor }" />
                <span class="block text-sm font-bold">{{ p.label }}</span>
                <span class="block text-xs text-slate-500">{{ p.hint }}</span>
              </label>
            </div>
          </fieldset>

          <label class="block">
            <span class="label">نام فروشگاه</span>
            <input v-model="form.name" class="input" maxlength="60" />
            <span v-if="nameError" class="mt-1 block text-xs text-red-600">{{ nameError }}</span>
          </label>

          <label class="block">
            <span class="label">توضیح کوتاه (اختیاری)</span>
            <textarea v-model="form.description" class="input" rows="3" maxlength="500" />
            <span class="hint">در صفحه‌ی اصلی و نتایج گوگل نمایش داده می‌شود.</span>
          </label>

          <button type="submit" class="btn btn-primary btn-lg w-full sm:w-auto" :disabled="saving">
            {{ saving ? 'در حال ذخیره…' : 'ذخیره و ادامه' }}
          </button>
        </form>

        <!-- پیش‌نمایش زنده -->
        <aside class="lg:col-span-2" aria-label="پیش‌نمایش">
          <div class="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div class="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="tech mx-auto truncate text-[10px] text-slate-400">
                {{ tenant?.subdomain }}.{{ $config.public.platformDomain }}
              </span>
            </div>
            <div class="space-y-4 p-4">
              <div class="flex items-center justify-between">
                <span class="font-extrabold" :style="{ color }">{{ form.name || 'نام فروشگاه' }}</span>
                <span class="flex gap-2">
                  <span class="h-2 w-8 rounded bg-slate-200" />
                  <span class="h-2 w-8 rounded bg-slate-200" />
                </span>
              </div>
              <div class="rounded-xl p-5" :style="{ background: color, color: textOnColor }">
                <div class="text-sm font-extrabold">{{ form.name || 'نام فروشگاه' }}</div>
                <div class="mt-1 line-clamp-2 text-xs opacity-90">
                  {{ form.description || 'توضیح کوتاه فروشگاه شما اینجا نمایش داده می‌شود.' }}
                </div>
                <span class="mt-3 inline-block rounded-lg bg-white/90 px-3 py-1 text-xs font-bold text-slate-900">
                  مشاهده محصولات
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div v-for="n in 3" :key="n" class="rounded-lg border border-slate-100 p-2">
                  <div class="mb-2 aspect-square rounded bg-slate-100" />
                  <div class="mb-1 h-2 w-4/5 rounded bg-slate-200" />
                  <div class="h-2 w-1/2 rounded" :style="{ background: color, opacity: 0.7 }" />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <!-- مرحله ۲: محصول -->
      <section v-else-if="step === 1" class="card mx-auto max-w-xl space-y-5 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <AppIcon name="products" :size="28" />
        </span>
        <div>
          <h1 class="page-title">اولین محصولتان را اضافه کنید</h1>
          <p class="mt-1 text-sm text-slate-500">
            با یک محصول، فروشگاهتان از حالت خالی درمی‌آید و می‌توانید سفارش بگیرید.
          </p>
        </div>
        <p v-if="productCount" class="alert-warn !bg-emerald-50 !text-emerald-700">
          {{ formatNumber(productCount) }} محصول دارید؛ می‌توانید ادامه دهید.
        </p>
        <div class="flex flex-col justify-center gap-3 sm:flex-row">
          <NuxtLink to="/products/new" class="btn btn-primary btn-lg">
            <AppIcon name="plus" :size="18" />
            افزودن محصول
          </NuxtLink>
          <button type="button" class="btn btn-secondary btn-lg" @click="step = 2">
            {{ productCount ? 'ادامه' : 'بعداً اضافه می‌کنم' }}
          </button>
        </div>
      </section>

      <!-- مرحله ۳: آماده -->
      <section v-else class="card mx-auto max-w-xl space-y-5 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <AppIcon name="check" :size="28" />
        </span>
        <div>
          <h1 class="page-title">فروشگاه شما آماده است 🎉</h1>
          <p v-if="settings" class="tech mt-2 text-sm text-slate-600">{{ settings.storeUrl }}</p>
        </div>
        <div class="grid gap-3 text-sm sm:grid-cols-2">
          <NuxtLink to="/settings/payment" class="rounded-xl border border-slate-200 p-4 text-start transition hover:border-brand-500">
            <div class="font-bold">اتصال درگاه پرداخت</div>
            <div class="text-xs text-slate-500">برای دریافت پول از مشتری‌ها</div>
          </NuxtLink>
          <NuxtLink to="/settings/domains" class="rounded-xl border border-slate-200 p-4 text-start transition hover:border-brand-500">
            <div class="font-bold">دامنه‌ی اختصاصی</div>
            <div class="text-xs text-slate-500">آدرس دلخواه خودتان</div>
          </NuxtLink>
        </div>
        <div class="flex flex-col justify-center gap-3 sm:flex-row">
          <NuxtLink to="/" class="btn btn-primary btn-lg">رفتن به داشبورد</NuxtLink>
          <a v-if="settings" :href="settings.storeUrl" target="_blank" rel="noopener" class="btn btn-secondary btn-lg">
            مشاهده فروشگاه
            <AppIcon name="external" :size="16" />
          </a>
        </div>
      </section>
    </div>
  </div>
</template>
