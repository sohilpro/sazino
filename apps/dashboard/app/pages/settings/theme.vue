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

const signature = () =>
  JSON.stringify([
    form.name.trim(),
    form.description.trim(),
    form.primaryColor.toLowerCase(),
    form.font,
    logo.value?.id ?? null,
  ]);

function apply(dto: StoreSettingsDto) {
  form.name = dto.name;
  form.description = dto.description ?? '';
  form.primaryColor = dto.primaryColor;
  form.font = dto.font;
  logo.value = dto.logo;
  storeUrl.value = dto.storeUrl;
  savedSignature.value = signature();
}
if (data.value) apply(data.value);

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
  <div class="max-w-4xl space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold">ظاهر فروشگاه</h1>
      <a
        v-if="storeUrl"
        :href="storeUrl"
        target="_blank"
        rel="noopener"
        class="btn btn-secondary btn-sm"
      >
        مشاهده‌ی فروشگاه
      </a>
    </header>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <div v-else class="grid gap-6 lg:grid-cols-2">
      <form class="card space-y-5" novalidate @submit.prevent="save">
        <fieldset :disabled="!canEdit || saving" class="space-y-5">
          <label class="block">
            <span class="label">نام فروشگاه</span>
            <input v-model="form.name" class="input" maxlength="60" />
            <span v-if="nameError" class="mt-1 block text-xs text-red-700">{{ nameError }}</span>
          </label>

          <label class="block">
            <span class="label">توضیح کوتاه</span>
            <textarea v-model="form.description" rows="3" class="input" maxlength="500" />
            <span class="mt-1 block text-xs text-slate-500"
              >در صفحه‌ی اصلی پیش‌فرض و نتایج جستجو نمایش داده می‌شود ({{
                form.description.length
              }}
              / ۵۰۰)</span
            >
          </label>

          <div>
            <span class="label">لوگو</span>
            <div class="flex items-center gap-3">
              <img
                v-if="logo"
                :src="logo.urls.sm"
                :alt="logo.alt ?? 'لوگو'"
                class="h-14 w-auto max-w-32 rounded-lg border border-slate-200 object-contain p-1"
              />
              <div
                v-else
                class="flex size-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400"
              >
                بدون لوگو
              </div>
              <button type="button" class="btn btn-secondary btn-sm" @click="pickerOpen = true">
                {{ logo ? 'تغییر' : 'انتخاب' }}
              </button>
              <button
                v-if="logo"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="logo = null"
              >
                حذف
              </button>
            </div>
          </div>

          <div>
            <span class="label">رنگ اصلی</span>
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
                class="input max-w-40"
                dir="ltr"
                maxlength="7"
                placeholder="#4f46e5"
              />
            </div>
            <p v-if="!colorValid" class="mt-1 text-xs text-red-700">
              رنگ باید با فرمت #rrggbb باشد
            </p>
            <p v-else-if="lowContrast" class="mt-1 text-xs text-amber-700">
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
          <p v-else class="text-sm text-slate-600">
            فونت فروشگاه: <b>{{ STORE_FONTS[0].label }}</b>
            (فعلاً تنها فونت پشتیبانی‌شده است؛ فونت‌های بیشتر بعد از لانچ اضافه می‌شود)
          </p>
        </fieldset>

        <p v-if="!canEdit" class="text-sm text-slate-500">
          فقط مالک و مدیر می‌توانند ظاهر فروشگاه را تغییر دهند.
        </p>
        <button v-else type="submit" class="btn btn-primary" :disabled="saving || !dirty">
          {{ saving ? 'در حال ذخیره…' : 'ذخیره' }}
        </button>
      </form>

      <!-- پیش‌نمایش زنده -->
      <section class="space-y-3">
        <h2 class="text-lg font-bold">پیش‌نمایش</h2>
        <div
          class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
          :data-font="form.font"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="logo"
              :src="logo.urls.sm"
              :alt="form.name"
              class="h-10 w-auto max-w-32 object-contain"
            />
            <span
              v-else
              class="flex size-10 items-center justify-center rounded-xl text-lg font-extrabold"
              :style="{ backgroundColor: previewColor, color: contrastColor(previewColor) }"
            >
              {{ initial }}
            </span>
            <span class="text-lg font-extrabold">{{ form.name || 'نام فروشگاه' }}</span>
          </div>

          <p class="leading-7 text-slate-600">
            {{ form.description.trim() || 'توضیح کوتاه فروشگاه شما اینجا نمایش داده می‌شود.' }}
          </p>

          <div class="flex flex-wrap items-center gap-4">
            <span
              class="inline-flex rounded-lg px-5 py-2.5 text-sm font-medium"
              :style="{ backgroundColor: previewColor, color: contrastColor(previewColor) }"
            >
              افزودن به سبد خرید
            </span>
            <span class="font-bold" :style="{ color: brandTextColor(previewColor) }"
              >۱٬۲۰۰٬۰۰۰ تومان</span
            >
          </div>
        </div>
        <p class="text-xs text-slate-500">در ویترین هم همین رنگ و فونت اعمال می‌شود.</p>
      </section>
    </div>

    <MediaPicker v-model:open="pickerOpen" @select="onLogoPicked" />
  </div>
</template>
