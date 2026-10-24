<script setup lang="ts">
import type { AddressDto } from '@myapp/shared-types';

const props = defineProps<{
  defaultName?: string | null;
  defaultPhone?: string;
  cancellable?: boolean;
}>();
const emit = defineEmits<{ saved: [address: AddressDto]; cancel: [] }>();

const form = reactive({
  recipientName: props.defaultName ?? '',
  recipientPhone: props.defaultPhone ?? '',
  province: '',
  city: '',
  address: '',
  postalCode: '',
});
const saving = ref(false);
const error = ref('');

function validate(): string | null {
  if (form.recipientName.trim().length < 2) return 'نام گیرنده را وارد کنید';
  if (!form.recipientPhone.trim()) return 'شماره‌ی موبایل گیرنده را وارد کنید';
  if (!form.province) return 'استان را انتخاب کنید';
  if (form.city.trim().length < 2) return 'شهر را وارد کنید';
  if (form.address.trim().length < 10) return 'نشانی باید کامل‌تر باشد';
  if (!/^\d{10}$/.test(toLatinDigits(form.postalCode).replace(/[\s-]/g, ''))) {
    return 'کد پستی باید ۱۰ رقم باشد';
  }
  return null;
}

async function submit() {
  error.value = validate() ?? '';
  if (error.value) return;

  saving.value = true;
  try {
    const saved = await $fetch<AddressDto>('/api/storefront/addresses', {
      method: 'POST',
      body: { ...form },
    });
    emit('saved', saved);
  } catch (e) {
    error.value = apiErrorMessage(e, 'ذخیره‌ی نشانی ناموفق بود');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="grid gap-3 sm:grid-cols-2" novalidate @submit.prevent="submit">
    <label class="block">
      <span class="label">نام گیرنده</span>
      <input v-model="form.recipientName" class="input" maxlength="60" autocomplete="name" />
    </label>
    <label class="block">
      <span class="label">موبایل گیرنده</span>
      <input v-model="form.recipientPhone" class="input" dir="ltr" inputmode="tel" autocomplete="tel" />
    </label>
    <label class="block">
      <span class="label">استان</span>
      <select v-model="form.province" class="input">
        <option value="">انتخاب کنید</option>
        <option v-for="p in IRAN_PROVINCES" :key="p" :value="p">{{ p }}</option>
      </select>
    </label>
    <label class="block">
      <span class="label">شهر</span>
      <input v-model="form.city" class="input" maxlength="60" />
    </label>
    <label class="block sm:col-span-2">
      <span class="label">نشانی کامل</span>
      <textarea v-model="form.address" class="input" rows="3" maxlength="300" />
    </label>
    <label class="block">
      <span class="label">کد پستی (۱۰ رقم)</span>
      <input v-model="form.postalCode" class="input" dir="ltr" inputmode="numeric" maxlength="12" />
    </label>

    <div class="flex items-end gap-2 sm:col-span-2">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'در حال ذخیره…' : 'ذخیره‌ی نشانی' }}
      </button>
      <button v-if="cancellable" type="button" class="btn btn-secondary" @click="emit('cancel')">
        انصراف
      </button>
    </div>
    <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">
      {{ error }}
    </p>
  </form>
</template>