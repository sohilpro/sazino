<script setup lang="ts">
import type { ImageDto, MediaDto, StoreSettingsDto } from '@myapp/shared-types';
import { onBeforeRouteLeave } from 'vue-router';

useHead({ title: 'ظاهر فروشگاه' });

const api = useApi();
const toast = useToast();
const { user } = useAuth();

const canEdit = computed(() => user.value?.role === 'OWNER' || user.value?.role === 'ADMIN');

const { data, error } = await useAsyncData('theme-settings', () =>
  api<StoreSettingsDto>('/store-settings'),
);

const form = reactive({
  name: '',
  description: '',
  primaryColor: DEFAULT_PRIMARY,
  font: 'Vazirmatn FD' as StoreFontKey,
});
const logo = ref<ImageDto | null>(null);
const savedSignature = ref('');
const storeUrl = ref('');
const lastDto = ref<StoreSettingsDto | null>(null);
const storeHost = computed(() => storeUrl.value.replace(/^https?:\/\//, ''));

const signature = () =>
  JSON.stringify([
    form.name.trim(),
    form.description.trim(),
    form.primaryColor.toLowerCase(),
    form.font,
    logo.value?.id ?? null,
  ]);

function apply(dto: StoreSettingsDto) {
  lastDto.value = dto;
  form.name = dto.name;
  form.description = dto.description ?? '';
  form.primaryColor = dto.primaryColor;
  form.font = dto.font;
  logo.value = dto.logo;
  storeUrl.value = dto.storeUrl;
  savedSignature.value = signature();
}
if (data.value) apply(data.value);

function discard() {
  if (lastDto.value) apply(lastDto.value);
}

const dirty = computed(() => signature() !== savedSignature.value);
const colorValid = computed(() => isHexColor(form.primaryColor));
const lowContrast = computed(() => colorValid.value && lowContrastOnWhite(form.primaryColor));
const nameError = computed(() =>
  form.name.trim().length < 2 ? 'نام فروشگاه باید حداقل ۲ کاراکتر باشد' : '',
);

const previewColor = computed(() =>
  colorValid.value ? form.primaryColor.toLowerCase() : DEFAULT_PRIMARY,
);
const initial = computed(() => [...(form.name.trim() || '?')][0]);

// ───────────── لوگو ─────────────
const pickerOpen = ref(false);
function onLogoPicked(media: MediaDto) {
  logo.value = media;
}

// ───────────── ذخیره ─────────────
const saving = ref(false);

async function save() {
  if (nameError.value) return void toast.error(nameError.value);
  if (!colorValid.value) return void toast.error('رنگ باید با فرمت #rrggbb باشد');
  if (form.description.length > 500) return void toast.error('توضیح حداکثر ۵۰۰ کاراکتر است');

  saving.value = true;
  try {
    apply(
      await api<StoreSettingsDto>('/store-settings', {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          primaryColor: form.primaryColor.toLowerCase(),
          font: form.font,
          logoMediaId: logo.value?.id ?? null,
        },
      }),
    );
    toast.success('تنظیمات ذخیره شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave(
  () => !dirty.value || confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟'),
);
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <PageHeader title="تنظیمات" subtitle="ظاهر و اطلاعات فروشگاه، پرداخت، دامنه و پلن">
      <a v-if="storeUrl" :href="storeUrl" target="_blank" rel="noopener" class="btn btn-secondary">
        مشاهده‌ی فروشگاه
        <AppIcon name="external" :size="16" />
      </a>
    </PageHeader>
    <SettingsTabs />

    <p v-if="error" class="alert-error">{{ apiErrorMessage(error) }}</p>

    <div v-else class="grid gap-6 lg:grid-cols-5">
      <form id="theme-form" class="space-y-6 lg:col-span-3" novalidate @submit.prevent="save">
        <fieldset :disabled="!canEdit || saving" class="space-y-6">
          <FormSection title="هویت فروشگاه">
            <label class="block">
              <span class="label">نام فروشگاه</span>
              <input v-model="form.name" class="input" maxlength="60" />
              <span v-if="nameError" class="mt-1 block text-xs text-red-700">{{ nameError }}</span>
            </label>

            <label class="block">
              <span class="label">توضیح کوتاه</span>
              <textarea v-model="form.description" rows="3" class="input" maxlength="500" />
              <span class="hint">
                در صفحه‌ی اصلی و نتایج جستجو نمایش داده می‌شود ({{ formatNumber(form.description.length) }} /
                {{ formatNumber(500) }})
              </span>
            </label>

            <div>
              <span class="label">لوگو</span>
              <div class="flex flex-wrap items-center gap-3">
                <img
                  v-if="logo"
                  :src="logo.urls.sm"
                  :alt="logo.alt ?? 'لوگو'"
                  class="h-16 w-auto max-w-36 rounded-xl border border-slate-200 bg-white object-contain p-1.5"
                />
                <span
                  v-else
                  class="grid size-16 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300"
                >
                  <AppIcon name="image" :size="26" />
                </span>
                <button type="button" class="btn btn-secondary btn-sm" @click="pickerOpen = true">
                  {{ logo ? 'تغییر لوگو' : 'انتخاب لوگو' }}
                </button>
                <button v-if="logo" type="button" class="btn btn-ghost btn-sm text-red-600" @click="logo = null">
                  حذف
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection title="رنگ و فونت" description="در ویترین هم همین رنگ و فونت اعمال می‌شود.">
            <div>
              <span class="label">سبک‌های آماده</span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="pr in LOOK_PRESETS"
                  :key="pr.key"
                  type="button"
                  class="flex items-center gap-2 rounded-full border-2 py-1 pe-3 ps-1 text-sm transition"
                  :class="
                    form.primaryColor.toLowerCase() === pr.primaryColor
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300'
                  "
                  @click="form.primaryColor = pr.primaryColor"
                >
                  <span class="size-6 rounded-full" :style="{ background: pr.primaryColor }" />
                  {{ pr.label }}
                </button>
              </div>
            </div>

            <div>
              <span class="label">رنگ دلخواه</span>
              <div class="flex items-center gap-3">
                <input
                  type="color"
                  :value="previewColor"
                  class="size-11 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  aria-label="انتخاب رنگ"
                  @input="form.primaryColor = ($event.target as HTMLInputElement).value"
                />
                <input
                  v-model="form.primaryColor"
                  class="input tech max-w-40"
                  dir="ltr"
                  maxlength="7"
                  placeholder="#4f46e5"
                />
              </div>
              <p v-if="!colorValid" class="mt-1 text-xs text-red-700">رنگ باید با فرمت #rrggbb باشد</p>
              <p v-else-if="lowContrast" class="alert-warn mt-2">
                این رنگ روی پس‌زمینه‌ی سفید کم‌رنگ است؛ قیمت‌ها و لینک‌های رنگی ممکن است خوانا نباشند.
                رنگ تیره‌تری امتحان کنید.
              </p>
            </div>

            <label v-if="STORE_FONTS.length > 1" class="block">
              <span class="label">فونت</span>
              <select v-model="form.font" class="input">
                <option v-for="f in STORE_FONTS" :key="f.key" :value="f.key">{{ f.label }}</option>
              </select>
            </label>
            <p v-else class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              فونت فروشگاه: <b>{{ STORE_FONTS[0].label }}</b>
              (فعلاً تنها فونت پشتیبانی‌شده است؛ فونت‌های بیشتر بعد از لانچ اضافه می‌شود)
            </p>
          </FormSection>
        </fieldset>

        <p v-if="!canEdit" class="text-sm text-slate-500">
          فقط مالک و مدیر می‌توانند ظاهر فروشگاه را تغییر دهند.
        </p>
      </form>

      <!-- پیش‌نمایش زنده -->
      <aside class="lg:col-span-2" aria-label="پیش‌نمایش">
        <div class="space-y-3 lg:sticky lg:top-6">
          <h2 class="text-sm font-bold text-slate-500">پیش‌نمایش زنده</h2>
          <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" :data-font="form.font">
            <div class="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="size-2.5 rounded-full bg-slate-300" />
              <span class="tech mx-auto truncate text-[10px] text-slate-400">{{ storeHost }}</span>
            </div>
            <div class="space-y-4 p-5">
              <div class="flex items-center gap-3">
                <img v-if="logo" :src="logo.urls.sm" :alt="form.name" class="h-9 w-auto max-w-28 object-contain" />
                <span
                  v-else
                  class="grid size-9 place-items-center rounded-xl text-base font-extrabold"
                  :style="{ backgroundColor: previewColor, color: contrastColor(previewColor) }"
                >
                  {{ initial }}
                </span>
                <span class="font-extrabold">{{ form.name || 'نام فروشگاه' }}</span>
              </div>

              <p class="text-sm leading-7 text-slate-600">
                {{ form.description.trim() || 'توضیح کوتاه فروشگاه شما اینجا نمایش داده می‌شود.' }}
              </p>

              <div class="grid grid-cols-2 gap-3">
                <div v-for="n in 2" :key="n" class="rounded-xl border border-slate-100 p-2.5">
                  <div class="mb-2 aspect-[4/3] rounded-lg bg-slate-100" />
                  <div class="mb-1.5 h-2.5 w-3/4 rounded bg-slate-200" />
                  <div class="text-sm font-bold" :style="{ color: brandTextColor(previewColor) }">
                    ۱٬۲۰۰٬۰۰۰ تومان
                  </div>
                </div>
              </div>

              <span
                class="flex justify-center rounded-lg px-5 py-2.5 text-sm font-medium"
                :style="{ backgroundColor: previewColor, color: contrastColor(previewColor) }"
              >
                افزودن به سبد خرید
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- نوار ذخیره: فقط وقتی تغییر ذخیره‌نشده هست -->
    <div
      v-if="canEdit && dirty"
      class="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      role="region"
      aria-label="ذخیره‌ی تغییرات"
    >
      <span class="flex items-center gap-2 text-sm text-slate-600">
        <span class="size-2 rounded-full bg-amber-500" />
        تغییرات ذخیره‌نشده
      </span>
      <div class="flex gap-2">
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="discard">بازگردانی</button>
        <button type="submit" form="theme-form" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'در حال ذخیره…' : 'ذخیره' }}
        </button>
      </div>
    </div>

    <MediaPicker v-model:open="pickerOpen" @select="onLogoPicked" />
  </div>
</template>
