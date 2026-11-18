<script setup lang="ts">
import type { VariantDto } from '@myapp/shared-types';

const props = defineProps<{
  variant: VariantDto | undefined;
  /** در موبایل، ردیف خرید به پایین صفحه می‌چسبد */
  sticky?: boolean;
}>();

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
  <div
    class="space-y-3"
    :class="
      sticky
        ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:border-t max-md:border-slate-200 max-md:bg-white/95 max-md:p-3 max-md:shadow-[0_-4px_16px_rgb(15_23_42/0.08)] max-md:backdrop-blur'
        : ''
    "
  >
    <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error }}</p>

    <p
      v-else-if="added"
      class="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      role="status"
    >
      <span class="flex items-center gap-1.5">
        <StoreIcon name="check" :size="16" />
        به سبد خرید اضافه شد.
      </span>
      <NuxtLink to="/cart" class="font-bold underline">مشاهده‌ی سبد</NuxtLink>
    </p>

    <button v-if="!variant?.inStock" type="button" class="btn btn-secondary btn-lg w-full" disabled>
      ناموجود
    </button>

    <div v-else class="flex items-center gap-3">
      <div class="flex items-center rounded-xl border border-slate-300 bg-white">
        <button
          type="button"
          class="grid size-11 place-items-center rounded-s-xl text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 disabled:opacity-40"
          :disabled="quantity >= MAX"
          aria-label="زیاد کردن"
          @click="quantity++"
        >
          <StoreIcon name="plus" :size="18" />
        </button>
        <span class="w-10 text-center text-sm font-bold" aria-live="polite">{{ formatNumber(quantity) }}</span>
        <button
          type="button"
          class="grid size-11 place-items-center rounded-e-xl text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 disabled:opacity-40"
          :disabled="quantity <= 1"
          aria-label="کم کردن"
          @click="quantity--"
        >
          <StoreIcon name="minus" :size="18" />
        </button>
      </div>

      <button type="button" class="btn btn-primary btn-lg min-w-0 flex-1" :disabled="busy" @click="submit">
        <StoreIcon name="cart" :size="20" />
        {{ busy ? 'در حال افزودن…' : 'افزودن به سبد خرید' }}
      </button>
    </div>

    <p v-if="inCart > 0 && !added && !error" class="text-xs text-slate-500">
      {{ formatNumber(inCart) }} عدد از این کالا در سبد شما هست.
    </p>
  </div>
</template>
