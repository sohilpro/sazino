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
    <div class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-extrabold sm:text-3xl">سبد خرید</h1>
        <span v-if="cart?.items.length" class="text-sm text-slate-500">{{ formatNumber(cart.itemCount) }} کالا</span>
      </div>
      <CheckoutSteps :current="1" />
    </div>

    <div v-if="!cart" class="grid gap-6 lg:grid-cols-3" aria-busy="true">
      <div class="space-y-3 lg:col-span-2">
        <div v-for="n in 2" :key="n" class="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
      <div class="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>

    <div
      v-else-if="!cart.items.length"
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"
    >
      <span class="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <StoreIcon name="cart" :size="32" />
      </span>
      <p class="mb-1 font-bold text-slate-800">سبد خرید شما خالی است</p>
      <p class="mb-5 text-sm text-slate-500">محصول دلخواهتان را پیدا کنید و به سبد اضافه کنید.</p>
      <NuxtLink to="/products" class="btn btn-primary btn-lg">مشاهده‌ی محصولات</NuxtLink>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-3 lg:col-span-2">
        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {{ error }}
        </p>

        <article
          v-for="item in cart.items"
          :key="item.variantId"
          class="flex gap-4 rounded-2xl border bg-white p-4 shadow-card"
          :class="item.issue ? 'border-amber-300' : 'border-slate-200'"
        >
          <NuxtLink :to="`/products/${encodeURIComponent(item.productSlug)}`" class="shrink-0">
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.imageAlt || item.productTitle"
              class="size-20 rounded-xl border border-slate-100 object-cover sm:size-24"
            />
            <div
              v-else
              class="flex size-20 items-center justify-center rounded-xl bg-slate-100 text-slate-300 sm:size-24"
            >
              <StoreIcon name="box" :size="32" />
            </div>
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <NuxtLink
                  :to="`/products/${encodeURIComponent(item.productSlug)}`"
                  class="block truncate font-medium transition hover:text-brand-700"
                >
                  {{ item.productTitle }}
                </NuxtLink>
                <span v-if="item.variantTitle !== 'پیش‌فرض'" class="text-xs text-slate-500">
                  {{ item.variantTitle }}
                </span>
              </div>
              <button
                type="button"
                class="icon-btn !size-9 shrink-0 text-slate-400 hover:!bg-red-50 hover:!text-red-600"
                :disabled="busy"
                :aria-label="`حذف ${item.productTitle} از سبد`"
                title="حذف"
                @click="drop(item)"
              >
                <StoreIcon name="trash" :size="18" />
              </button>
            </div>

            <p v-if="item.issue" class="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
              <StoreIcon name="alert" :size="16" class="mt-0.5 shrink-0" />
              <span>
                {{ ISSUE_TEXT[item.issue] }}
                <button
                  v-if="item.issue === 'INSUFFICIENT_STOCK'"
                  type="button"
                  class="font-medium underline"
                  :disabled="busy"
                  @click="change(item, item.maxQuantity)"
                >
                  (تنظیم به {{ formatNumber(item.maxQuantity) }} عدد)
                </button>
              </span>
            </p>

            <div class="mt-auto flex flex-wrap items-center justify-between gap-3">
              <div
                v-if="item.issue !== 'UNAVAILABLE' && item.issue !== 'OUT_OF_STOCK'"
                class="flex items-center rounded-xl border border-slate-300"
              >
                <button
                  type="button"
                  class="grid size-9 place-items-center rounded-s-xl text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 disabled:opacity-40"
                  :disabled="busy || item.quantity >= item.maxQuantity"
                  aria-label="زیاد کردن"
                  @click="change(item, item.quantity + 1)"
                >
                  <StoreIcon name="plus" :size="16" />
                </button>
                <span class="w-9 text-center text-sm font-bold">{{ formatNumber(item.quantity) }}</span>
                <button
                  type="button"
                  class="grid size-9 place-items-center rounded-e-xl text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 disabled:opacity-40"
                  :disabled="busy || item.quantity <= 1"
                  aria-label="کم کردن"
                  @click="change(item, item.quantity - 1)"
                >
                  <StoreIcon name="minus" :size="16" />
                </button>
              </div>

              <div class="ms-auto text-end">
                <div class="font-extrabold text-brand-700">{{ formatPrice(item.lineTotal) }}</div>
                <div v-if="item.quantity > 1" class="text-xs text-slate-400">
                  هر عدد {{ formatPrice(item.unitPrice) }}
                </div>
              </div>
            </div>
          </div>
        </article>

        <NuxtLink to="/products" class="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <StoreIcon name="chevronRight" :size="16" />
          ادامه‌ی خرید محصولات
        </NuxtLink>
      </div>

      <aside>
        <div class="card space-y-4 lg:sticky lg:top-32">
          <h2 class="text-lg font-bold">خلاصه‌ی سفارش</h2>
          <div class="flex items-center justify-between text-sm text-slate-600">
            <span>تعداد کالا</span>
            <span>{{ formatNumber(cart.itemCount) }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-slate-100 pt-4">
            <span class="font-medium">جمع کل</span>
            <span class="text-xl font-extrabold text-brand-700">{{ formatPrice(cart.subtotal) }}</span>
          </div>
          <p class="text-xs text-slate-500">هزینه‌ی ارسال در مرحله‌ی بعد محاسبه می‌شود.</p>
          <p v-if="cart.hasIssues" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            کالاهای دارای مشکل در جمع کل حساب نشده‌اند.
          </p>

          <NuxtLink
            v-if="loaded && !isLoggedIn"
            :to="{ path: '/login', query: { redirect: '/checkout' } }"
            class="btn btn-primary btn-lg w-full"
          >
            ورود و ادامه‌ی خرید
          </NuxtLink>
          <NuxtLink v-else-if="!cart.hasIssues" to="/checkout" class="btn btn-primary btn-lg w-full">
            ادامه‌ی خرید
          </NuxtLink>
          <button v-else type="button" class="btn btn-primary btn-lg w-full" disabled>
            ابتدا کالاهای دارای مشکل را اصلاح کنید
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
