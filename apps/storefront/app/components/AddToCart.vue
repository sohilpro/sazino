<script setup lang="ts">
import type { VariantDto } from '@myapp/shared-types';

const props = defineProps<{ variant: VariantDto | undefined }>();

const MAX = 20;
const { cart, busy, add } = useCart();

const quantity = ref(1);
const added = ref(false);
const error = ref('');

watch(
  () => props.variant?.id,
  () => {
    quantity.value = 1;
    added.value = false;
    error.value = '';
  },
);

const inCart = computed(
  () => cart.value?.items.find((i) => i.variantId === props.variant?.id)?.quantity ?? 0,
);

async function submit() {
  if (!props.variant) return;
  error.value = '';
  added.value = false;
  try {
    await add(props.variant.id, quantity.value);
    added.value = true;
  } catch (e) {
    error.value = apiErrorMessage(e);
  }
}
</script>

<template>
  <div class="space-y-3">
    <button v-if="!variant?.inStock" type="button" class="btn btn-secondary w-full" disabled>
      ناموجود
    </button>

    <div v-else class="flex flex-wrap items-center gap-3">
      <div class="flex items-center rounded-lg border border-slate-300 bg-white">
        <button
          type="button"
          class="size-10 text-lg hover:text-brand-700 disabled:opacity-40"
          :disabled="quantity <= 1"
          aria-label="کم کردن"
          @click="quantity--"
        >
          −
        </button>
        <span class="w-10 text-center text-sm font-medium" aria-live="polite">{{ formatNumber(quantity) }}</span>
        <button
          type="button"
          class="size-10 text-lg hover:text-brand-700 disabled:opacity-40"
          :disabled="quantity >= MAX"
          aria-label="زیاد کردن"
          @click="quantity++"
        >
          +
        </button>
      </div>

      <button type="button" class="btn btn-primary min-w-48 flex-1" :disabled="busy" @click="submit">
        {{ busy ? 'در حال افزودن…' : 'افزودن به سبد خرید' }}
      </button>
    </div>

    <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>

    <p v-else-if="added" class="text-sm text-emerald-700" role="status">
      به سبد خرید اضافه شد.
      <NuxtLink to="/cart" class="font-medium underline">مشاهده‌ی سبد</NuxtLink>
    </p>

    <p v-else-if="inCart > 0" class="text-xs text-slate-500">
      {{ formatNumber(inCart) }} عدد از این کالا در سبد شما هست.
    </p>
  </div>
</template>