<script setup lang="ts">
import type { CartItemDto } from '@myapp/shared-types';

useSeoMeta({ title: 'سبد خرید', robots: 'noindex, nofollow' });

const { cart, busy, setQuantity, remove } = useCart();
const { isLoggedIn, loaded } = useCustomer();
const error = ref('');

const ISSUE_TEXT: Record<NonNullable<CartItemDto['issue']>, string> = {
  UNAVAILABLE: 'این کالا دیگر عرضه نمی‌شود',
  OUT_OF_STOCK: 'این کالا ناموجود شده است',
  INSUFFICIENT_STOCK: 'موجودی کمتر از تعداد انتخاب‌شده است',
};

async function change(item: CartItemDto, quantity: number) {
  error.value = '';
  try {
    await setQuantity(item.variantId, quantity);
  } catch (e) {
    error.value = apiErrorMessage(e);
  }
}

async function drop(item: CartItemDto) {
  error.value = '';
  try {
    await remove(item.variantId);
  } catch (e) {
    error.value = apiErrorMessage(e);
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-extrabold">سبد خرید</h1>

    <p
      v-if="!cart"
      class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500"
    >
      در حال بارگذاری…
    </p>

    <div
      v-else-if="!cart.items.length"
      class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"
    >
      <p class="mb-4 text-slate-500">سبد خرید شما خالی است.</p>
      <NuxtLink to="/products" class="btn btn-primary">مشاهده‌ی محصولات</NuxtLink>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-3 lg:col-span-2">
        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {{ error }}
        </p>

        <article
          v-for="item in cart.items"
          :key="item.variantId"
          class="flex gap-4 rounded-2xl border bg-white p-4"
          :class="item.issue ? 'border-amber-300' : 'border-slate-200'"
        >
          <NuxtLink :to="`/products/${encodeURIComponent(item.productSlug)}`" class="shrink-0">
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.imageAlt || item.productTitle"
              class="size-20 rounded-xl object-cover"
            />
            <div
              v-else
              class="flex size-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400"
            >
              بدون تصویر
            </div>
          </NuxtLink>

          <div class="min-w-0 flex-1 space-y-2">
            <div>
              <NuxtLink
                :to="`/products/${encodeURIComponent(item.productSlug)}`"
                class="block truncate font-medium hover:text-brand-700"
              >
                {{ item.productTitle }}
              </NuxtLink>
              <span v-if="item.variantTitle !== 'پیش‌فرض'" class="text-xs text-slate-500">{{
                item.variantTitle
              }}</span>
            </div>

            <p v-if="item.issue" class="text-sm text-amber-700">
              {{ ISSUE_TEXT[item.issue] }}
              <button
                v-if="item.issue === 'INSUFFICIENT_STOCK'"
                type="button"
                class="underline"
                :disabled="busy"
                @click="change(item, item.maxQuantity)"
              >
                (تنظیم به {{ formatNumber(item.maxQuantity) }} عدد)
              </button>
            </p>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <div
                v-if="item.issue !== 'UNAVAILABLE' && item.issue !== 'OUT_OF_STOCK'"
                class="flex items-center rounded-lg border border-slate-300"
              >
                <button
                  type="button"
                  class="size-9 hover:text-brand-700 disabled:opacity-40"
                  :disabled="busy || item.quantity <= 1"
                  aria-label="کم کردن"
                  @click="change(item, item.quantity - 1)"
                >
                  −
                </button>
                <span class="w-9 text-center text-sm">{{ formatNumber(item.quantity) }}</span>
                <button
                  type="button"
                  class="size-9 hover:text-brand-700 disabled:opacity-40"
                  :disabled="busy || item.quantity >= item.maxQuantity"
                  aria-label="زیاد کردن"
                  @click="change(item, item.quantity + 1)"
                >
                  +
                </button>
              </div>

              <div class="text-end">
                <div class="font-bold text-brand-700">{{ formatPrice(item.lineTotal) }}</div>
                <div v-if="item.quantity > 1" class="text-xs text-slate-400">
                  هر عدد {{ formatPrice(item.unitPrice) }}
                </div>
              </div>

              <button
                type="button"
                class="text-sm text-red-600 hover:underline"
                :disabled="busy"
                @click="drop(item)"
              >
                حذف
              </button>
            </div>
          </div>
        </article>
      </div>

      <aside>
        <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
          <div class="flex items-center justify-between text-sm text-slate-600">
            <span>تعداد کالا</span>
            <span>{{ formatNumber(cart.itemCount) }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-4">
            <span class="font-medium">جمع کل</span>
            <span class="text-lg font-extrabold text-brand-700">{{
              formatPrice(cart.subtotal)
            }}</span>
          </div>
          <p v-if="cart.hasIssues" class="text-xs text-amber-700">
            کالاهای دارای مشکل در جمع کل حساب نشده‌اند.
          </p>

          <!-- <NuxtLink
            v-if="loaded && !isLoggedIn"
            :to="{ path: '/login', query: { redirect: '/cart' } }"
            class="btn btn-primary w-full"
          >
            ورود و ادامه‌ی خرید
          </NuxtLink> -->
          <NuxtLink
            v-if="loaded && !isLoggedIn"
            :to="{ path: '/login', query: { redirect: '/checkout' } }"
            class="btn btn-primary w-full"
          >
            ورود و ادامه‌ی خرید
          </NuxtLink>
          <NuxtLink v-else-if="!cart.hasIssues" to="/checkout" class="btn btn-primary w-full">
            ادامه‌ی خرید
          </NuxtLink>
          <button v-else type="button" class="btn btn-primary w-full" disabled>
            ابتدا کالاهای دارای مشکل را اصلاح کنید
          </button>
          <!-- مرحله‌ی پرداخت (آدرس، ارسال، درگاه) در روز ۱۱ و ۱۲ اینجا وصل می‌شود -->
          <!-- <button v-else type="button" class="btn btn-primary w-full" disabled>
            ادامه‌ی خرید (به‌زودی)
          </button> -->
        </div>
      </aside>
    </div>
  </div>
</template>
