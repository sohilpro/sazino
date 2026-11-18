<script setup lang="ts">
import type {
  AddressDto,
  CheckoutQuoteDto,
  OrderDto,
  ShippingMethodDto,
} from '@myapp/shared-types';

useSeoMeta({ title: 'تکمیل خرید', robots: 'noindex, nofollow' });

const { ready } = useRequireLogin('/checkout');
const { customer } = useCustomer();
const cartState = useCart();
const { cart } = cartState;

const addresses = ref<AddressDto[]>([]);
const methods = ref<ShippingMethodDto[]>([]);
const addressId = ref('');
const methodId = ref('');
const note = ref('');
const quote = ref<CheckoutQuoteDto | null>(null);
const showAddressForm = ref(false);
const loading = ref(true);
const loadError = ref('');
const submitting = ref(false);
const error = ref('');

async function refreshQuote() {
  if (!methodId.value) {
    quote.value = null;
    return;
  }
  try {
    quote.value = await $fetch<CheckoutQuoteDto>('/api/storefront/checkout/quote', {
      query: { shippingMethodId: methodId.value },
    });
  } catch (e) {
    error.value = apiErrorMessage(e);
  }
}

async function loadAll() {
  loading.value = true;
  loadError.value = '';
  try {
    const [addrs, shipping] = await Promise.all([
      $fetch<AddressDto[]>('/api/storefront/addresses'),
      $fetch<ShippingMethodDto[]>('/api/storefront/shipping-methods'),
      cartState.load(),
    ]);
    addresses.value = addrs;
    methods.value = shipping;
    addressId.value = (addrs.find((a) => a.isDefault) ?? addrs[0])?.id ?? '';
    methodId.value = shipping[0]?.id ?? '';
    showAddressForm.value = addrs.length === 0;
    await refreshQuote();
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'بارگذاری اطلاعات ناموفق بود');
  } finally {
    loading.value = false;
  }
}

watch(ready, (isReady) => isReady && void loadAll(), { immediate: true });
watch(methodId, () => void refreshQuote());

function onAddressSaved(address: AddressDto) {
  addresses.value = [address, ...addresses.value.map((a) => (address.isDefault ? { ...a, isDefault: false } : a))];
  addressId.value = address.id;
  showAddressForm.value = false;
}

const canSubmit = computed(
  () =>
    !submitting.value &&
    Boolean(addressId.value && methodId.value && quote.value) &&
    !quote.value?.hasIssues &&
    (cart.value?.items.length ?? 0) > 0,
);

async function submit() {
  error.value = '';
  if (!addressId.value) {
    error.value = 'نشانی تحویل را انتخاب یا اضافه کنید';
    return;
  }
  if (!quote.value) return;

  submitting.value = true;
  try {
    const order = await $fetch<OrderDto>('/api/storefront/orders', {
      method: 'POST',
      body: {
        addressId: addressId.value,
        shippingMethodId: methodId.value,
        expectedTotal: quote.value.total,
        note: note.value.trim() || undefined,
      },
    });
    await cartState.load();
    await navigateTo({ path: `/orders/${order.number}`, query: { placed: '1' } });
  } catch (e) {
    const code = codeOf(e);
    // مبلغ یا موجودی عوض شده: سبد و مبلغ تازه می‌شود تا مشتری دوباره بررسی کند
    if (code === 'PRICE_CHANGED' || code === 'OUT_OF_STOCK' || code === 'CART_ISSUES') {
      await Promise.all([cartState.load(), refreshQuote()]);
    }
    error.value = apiErrorMessage(e, 'ثبت سفارش ناموفق بود');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <h1 class="text-2xl font-extrabold sm:text-3xl">تکمیل خرید</h1>
      <CheckoutSteps :current="2" />
    </div>

    <div v-if="!ready || loading" class="grid gap-6 lg:grid-cols-3" aria-busy="true">
      <div class="space-y-4 lg:col-span-2">
        <div v-for="n in 3" :key="n" class="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
      <div class="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
    <p v-else-if="loadError" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      {{ loadError }}
    </p>

    <div
      v-else-if="!cart || cart.items.length === 0"
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
    >
      <span class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <StoreIcon name="cart" :size="28" />
      </span>
      <p class="mb-4 font-medium text-slate-700">سبد خرید شما خالی است.</p>
      <NuxtLink to="/products" class="btn btn-primary">مشاهده‌ی محصولات</NuxtLink>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <section class="card space-y-3">
          <h2 class="flex items-center gap-2 text-lg font-bold">
            <StoreIcon name="mapPin" :size="20" class="text-brand-600" />
            نشانی تحویل
          </h2>

          <template v-if="!showAddressForm">
            <label
              v-for="a in addresses"
              :key="a.id"
              class="flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition"
              :class="a.id === addressId ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input v-model="addressId" type="radio" name="address" :value="a.id" class="mt-1.5 size-4 accent-brand-600" />
              <span class="text-sm leading-7">
                <b>{{ a.recipientName }}</b> · <span dir="ltr">{{ a.recipientPhone }}</span>
                <span v-if="a.isDefault" class="badge ms-2 bg-slate-100 text-slate-600">پیش‌فرض</span><br />
                {{ a.province }}، {{ a.city }}، {{ a.address }}<br />
                کد پستی: <span dir="ltr">{{ a.postalCode }}</span>
              </span>
            </label>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-brand-700 transition hover:border-brand-500 hover:bg-brand-50"
              @click="showAddressForm = true"
            >
              <StoreIcon name="plus" :size="16" />
              افزودن نشانی جدید
            </button>
          </template>

          <AddressForm
            v-else
            :default-name="customer?.name"
            :default-phone="customer?.phone"
            :cancellable="addresses.length > 0"
            @saved="onAddressSaved"
            @cancel="showAddressForm = false"
          />
        </section>

        <section class="card space-y-3">
          <h2 class="flex items-center gap-2 text-lg font-bold">
            <StoreIcon name="truck" :size="20" class="text-brand-600" />
            روش ارسال
          </h2>
          <p v-if="!methods.length" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            این فروشگاه هنوز روش ارسالی تعریف نکرده است.
          </p>
          <label
            v-for="m in methods"
            :key="m.id"
            class="flex cursor-pointer items-start justify-between gap-3 rounded-xl border-2 p-3.5 transition"
            :class="m.id === methodId ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'"
          >
            <span class="flex gap-3">
              <input v-model="methodId" type="radio" name="method" :value="m.id" class="mt-1.5 size-4 accent-brand-600" />
              <span class="text-sm">
                <b>{{ m.title }}</b>
                <span v-if="m.description" class="block text-xs text-slate-500">{{ m.description }}</span>
                <span v-if="m.freeThreshold" class="block text-xs text-emerald-700">
                  ارسال رایگان برای خرید بالای {{ formatPrice(m.freeThreshold) }}
                </span>
              </span>
            </span>
            <span class="shrink-0 text-sm font-bold" :class="!m.fee && 'text-emerald-700'">
              {{ m.fee ? formatPrice(m.fee) : 'رایگان' }}
            </span>
          </label>
        </section>

        <section class="card space-y-2">
          <h2 class="text-lg font-bold">توضیحات سفارش (اختیاری)</h2>
          <textarea v-model="note" class="input" rows="3" maxlength="500" placeholder="مثلاً: لطفاً قبل از ارسال تماس بگیرید" />
        </section>
      </div>

      <aside>
        <div class="card space-y-4 lg:sticky lg:top-32">
          <h2 class="text-lg font-bold">خلاصه‌ی سفارش</h2>

          <ul class="space-y-3 text-sm">
            <li v-for="item in cart.items" :key="item.variantId" class="flex items-center gap-3">
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                alt=""
                class="size-12 shrink-0 rounded-lg border border-slate-100 object-cover"
              />
              <span v-else class="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                <StoreIcon name="box" :size="20" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="line-clamp-1 block">{{ item.productTitle }}</span>
                <span class="text-xs text-slate-400">× {{ formatNumber(item.quantity) }}</span>
              </span>
              <span class="shrink-0 font-medium">{{ formatPrice(item.lineTotal) }}</span>
            </li>
          </ul>

          <template v-if="quote">
            <dl class="space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-600">جمع کالاها</dt>
                <dd>{{ formatPrice(quote.subtotal) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-600">هزینه‌ی ارسال</dt>
                <dd :class="quote.shippingFee === 0 && 'text-emerald-700'">
                  {{ quote.shippingFee ? formatPrice(quote.shippingFee) : 'رایگان' }}
                </dd>
              </div>
              <div class="flex justify-between border-t border-slate-100 pt-3 text-base font-extrabold">
                <dt>مبلغ قابل پرداخت</dt>
                <dd class="text-brand-700">{{ formatPrice(quote.total) }}</dd>
              </div>
            </dl>
          </template>

          <p v-if="quote?.hasIssues" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            برخی کالاهای سبد در دسترس نیستند.
            <NuxtLink to="/cart" class="font-medium underline">اصلاح سبد</NuxtLink>
          </p>
          <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {{ error }}
            <NuxtLink v-if="error.includes('پرداخت‌نشده')" to="/orders" class="font-medium underline">
              سفارش‌های من
            </NuxtLink>
          </p>

          <button type="button" class="btn btn-primary btn-lg w-full" :disabled="!canSubmit" @click="submit">
            {{ submitting ? 'در حال ثبت…' : 'ثبت سفارش' }}
          </button>
          <p class="flex items-start gap-1.5 text-xs leading-5 text-slate-500">
            <StoreIcon name="lock" :size="14" class="mt-0.5 shrink-0" />
            پس از ثبت، موجودی کالاها ۳۰ دقیقه برای شما نگه داشته می‌شود و پرداخت در درگاه امن انجام می‌شود.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
