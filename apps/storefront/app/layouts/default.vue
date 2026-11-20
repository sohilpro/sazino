<script setup lang="ts">
const isPlatform = useIsPlatform();
const store = useStore();
const route = useRoute();

// اگر در هاست پلتفرم هستیم، نیازی به واکشی دسته‌بندی‌های فروشگاه نیست
const { roots } = isPlatform.value
  ? { roots: ref([]) }
  : await useStoreCategories();

const initial = computed(() => [...(store.value?.name ?? '?')][0]);
const navCategories = computed(() => roots.value.slice(0, 6));
const footerCategories = computed(() => roots.value.slice(0, 6));

const menuOpen = ref(false);
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false;
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

const linkClass = 'rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-brand-700';
const activeClass = '!text-brand-700 font-semibold';
</script>

<template>
  <!-- حالت هاست پلتفرم سازینو: لایوت کامل صفحه لندینگ پلتفرم -->
  <div v-if="isPlatform" class="min-h-screen bg-slate-50">
    <slot />
  </div>

  <!-- حالت هاست فروشگاه: هدر، ناوبری، محتوا و فوتر اختصاصی فروشگاه -->
  <div v-else class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3">
        <button
          type="button"
          class="icon-btn lg:hidden"
          aria-label="منو"
          :aria-expanded="menuOpen"
          @click="menuOpen = true"
        >
          <StoreIcon name="menu" />
        </button>

        <NuxtLink to="/" class="flex min-w-0 items-center gap-3">
          <img
            v-if="store?.logoUrl"
            :src="store.logoUrl"
            :alt="store.name"
            class="h-10 w-auto max-w-32 object-contain"
          />
          <span
            v-else
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-extrabold text-on-brand"
          >
            {{ initial }}
          </span>
          <span class="truncate text-lg font-extrabold">{{ store?.name }}</span>
        </NuxtLink>

        <div class="order-last w-full md:order-none md:mx-auto md:w-auto md:max-w-md md:flex-1">
          <SearchBox />
        </div>

        <div class="ms-auto flex items-center gap-1 md:ms-0">
          <AccountLink />
          <CartButton />
        </div>
      </div>

      <!-- نوار دسته‌بندی (دسکتاپ) -->
      <nav class="hidden border-t border-slate-100 lg:block" aria-label="دسته‌بندی‌ها">
        <div class="mx-auto flex max-w-6xl items-center gap-1 px-4 py-1.5">
          <NuxtLink to="/" :class="linkClass" exact-active-class="!text-brand-700 font-semibold">خانه</NuxtLink>
          <NuxtLink to="/products" :class="linkClass" :exact-active-class="activeClass">همه‌ی محصولات</NuxtLink>
          <NuxtLink
            v-for="c in navCategories"
            :key="c.id"
            :to="`/categories/${encodeURIComponent(c.slug)}`"
            :class="linkClass"
            :active-class="activeClass"
          >
            {{ c.name }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <!-- منوی موبایل -->
    <div v-if="menuOpen" class="fixed inset-0 z-50 lg:hidden">
      <div class="absolute inset-0 bg-slate-900/50" @click="menuOpen = false" />
      <nav
        class="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-white p-4 shadow-xl"
        aria-label="منوی اصلی"
      >
        <div class="mb-3 flex items-center justify-between">
          <span class="truncate text-lg font-extrabold">{{ store?.name }}</span>
          <button type="button" class="icon-btn" aria-label="بستن منو" @click="menuOpen = false">
            <StoreIcon name="close" />
          </button>
        </div>
        <NuxtLink to="/" :class="linkClass" exact-active-class="!text-brand-700 font-semibold">خانه</NuxtLink>
        <NuxtLink to="/products" :class="linkClass" :exact-active-class="activeClass">همه‌ی محصولات</NuxtLink>
        <template v-if="roots.length">
          <div class="mt-3 px-3 text-xs font-medium text-slate-400">دسته‌بندی‌ها</div>
          <NuxtLink
            v-for="c in roots"
            :key="c.id"
            :to="`/categories/${encodeURIComponent(c.slug)}`"
            :class="linkClass"
            :active-class="activeClass"
          >
            {{ c.name }}
          </NuxtLink>
        </template>
        <div class="mt-3 px-3 text-xs font-medium text-slate-400">حساب کاربری</div>
        <NuxtLink to="/orders" :class="linkClass" :active-class="activeClass">سفارش‌های من</NuxtLink>
        <NuxtLink to="/cart" :class="linkClass" :active-class="activeClass">سبد خرید</NuxtLink>
      </nav>
    </div>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="mt-8 border-t border-slate-200 bg-white">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-3 lg:col-span-2">
          <div class="flex items-center gap-3">
            <img
              v-if="store?.logoUrl"
              :src="store.logoUrl"
              :alt="store.name"
              class="h-9 w-auto max-w-28 object-contain"
              loading="lazy"
            />
            <span
              v-else
              class="flex size-9 items-center justify-center rounded-xl bg-brand-600 font-extrabold text-on-brand"
            >
              {{ initial }}
            </span>
            <span class="text-lg font-extrabold">{{ store?.name }}</span>
          </div>
          <p v-if="store?.description" class="line-clamp-3 max-w-md text-sm leading-7 text-slate-500">
            {{ store.description }}
          </p>
        </div>

        <div>
          <h2 class="mb-3 text-sm font-bold">دسترسی سریع</h2>
          <ul class="space-y-2 text-sm text-slate-500">
            <li><NuxtLink to="/products" class="transition hover:text-brand-700">همه‌ی محصولات</NuxtLink></li>
            <li><NuxtLink to="/cart" class="transition hover:text-brand-700">سبد خرید</NuxtLink></li>
            <li><NuxtLink to="/orders" class="transition hover:text-brand-700">سفارش‌های من</NuxtLink></li>
          </ul>
        </div>

        <div v-if="footerCategories.length">
          <h2 class="mb-3 text-sm font-bold">دسته‌بندی‌ها</h2>
          <ul class="space-y-2 text-sm text-slate-500">
            <li v-for="c in footerCategories" :key="c.id">
              <NuxtLink :to="`/categories/${encodeURIComponent(c.slug)}`" class="transition hover:text-brand-700">
                {{ c.name }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-slate-100">
        <div
          class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row"
        >
          <span>© {{ formatYear() }} {{ store?.name }}</span>
          <span>قدرت‌گرفته از پلتفرم فروشگاه‌ساز</span>
        </div>
      </div>
    </footer>
  </div>
</template>
