<script setup lang="ts">
import type { Paginated, ProductDto } from '@myapp/shared-types';
import type { Crumb } from '~/utils/seo';

const route = useRoute();
const store = useStore();
const api = useStorefrontApi();
const siteUrl = useSiteUrl();

const slug = computed(() => String(route.params.slug));
const path = computed(() => `/products/${encodeURIComponent(slug.value)}`);
const canonical = computed(() => siteUrl(path.value));

const { data, error } = await useAsyncData(
  () => `product:${slug.value}`,
  async () => {
    const product = await api<ProductDto>(`/storefront/products/${encodeURIComponent(slug.value)}`);

    // محصولات هم‌دسته؛ بخش اختیاری است و خطایش صفحه را خراب نمی‌کند
    let related: ProductDto[] = [];
    if (product.category) {
      try {
        const res = await api<Paginated<ProductDto>>('/storefront/products', {
          query: { categorySlug: product.category.slug, limit: 5 },
        });
        related = res.items.filter((p) => p.id !== product.id).slice(0, 4);
      } catch {
        related = [];
      }
    }
    return { product, related };
  },
);

if (error.value) {
  throw statusOf(error.value) === 404
    ? notFoundError('Product Not Found')
    : createError({ statusCode: 502, statusMessage: 'Bad Gateway', fatal: true });
}

const product = computed(() => data.value?.product);
const related = computed(() => data.value?.related ?? []);

// ───────────── انتخاب تنوع ─────────────
const selectedId = ref('');
watch(
  product,
  (p) => {
    selectedId.value = (p?.variants.find((v) => v.inStock) ?? p?.variants[0])?.id ?? '';
  },
  { immediate: true },
);
const selected = computed(
  () =>
    product.value?.variants.find((v) => v.id === selectedId.value) ?? product.value?.variants[0],
);
const hasPriceRange = computed(() => (product.value?.minPrice ?? 0) !== (product.value?.maxPrice ?? 0));
const selectedDiscount = computed(() => (selected.value ? variantDiscount(selected.value) : null));

// ───────────── مسیر و سئو ─────────────
const crumbs = computed<Crumb[]>(() => {
  const p = product.value;
  if (!p) return [];
  return [
    { label: 'خانه', to: '/' },
    { label: 'محصولات', to: '/products' },
    ...(p.category
      ? [{ label: p.category.name, to: `/categories/${encodeURIComponent(p.category.slug)}` }]
      : []),
    { label: p.title },
  ];
});

const description = computed(
  () =>
    plainText(product.value?.description, 160) ||
    (product.value && store.value
      ? `خرید ${product.value.title} از ${store.value.name}`
      : undefined),
);
const mainImage = computed(() => product.value?.images[0]?.urls.md);

useSeoMeta({
  title: () => product.value?.title,
  description: () => description.value,
  ogTitle: () => product.value?.title,
  ogDescription: () => description.value,
  ogImage: () => mainImage.value,
  ogUrl: () => canonical.value,
  ogType: 'website',
  ogSiteName: () => store.value?.name,
  ogLocale: 'fa_IR',
  twitterCard: () => (mainImage.value ? 'summary_large_image' : 'summary'),
});

useHead(() => {
  const p = product.value;
  if (!p) return {};
  return {
    link: [{ rel: 'canonical', href: canonical.value }],
    script: [
      jsonLdScript(
        jsonLdGraph(
          productJsonLd(p, { url: canonical.value, storeName: store.value?.name ?? '' }),
          breadcrumbJsonLd(
            crumbs.value.map((c) => ({ name: c.label, url: siteUrl(c.to ?? path.value) })),
          ),
        ),
      ),
    ],
  };
});
</script>

<template>
  <div v-if="product" class="space-y-10 pb-24 md:pb-0">
    <Breadcrumbs :items="crumbs" />

    <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div class="lg:sticky lg:top-32 lg:self-start">
        <ProductGallery :images="product.images" :title="product.title" />
      </div>

      <div class="space-y-6">
        <header class="space-y-3">
          <NuxtLink
            v-if="product.category"
            :to="`/categories/${encodeURIComponent(product.category.slug)}`"
            class="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
          >
            {{ product.category.name }}
          </NuxtLink>
          <h1 class="text-2xl font-extrabold leading-9 sm:text-3xl sm:leading-10">{{ product.title }}</h1>
        </header>

        <div class="card space-y-5 !p-5 sm:!p-6">
          <div v-if="selected" class="space-y-1">
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-3xl font-extrabold text-brand-700">{{ formatPrice(selected.price) }}</span>
              <span v-if="selectedDiscount" class="badge bg-rose-600 text-white">
                {{ formatNumber(selectedDiscount.percent) }}٪ تخفیف
              </span>
            </div>
            <div v-if="selectedDiscount" class="text-sm text-slate-400 line-through">
              {{ formatPrice(selectedDiscount.compareAt) }}
            </div>
          </div>

          <div v-if="product.variants.length > 1" class="space-y-2">
            <div class="text-sm font-medium text-slate-700">
              انتخاب تنوع<span v-if="selected">: <b class="text-slate-900">{{ selected.title }}</b></span>
            </div>
            <div role="radiogroup" aria-label="انتخاب تنوع" class="flex flex-wrap gap-2">
              <button
                v-for="v in product.variants"
                :key="v.id"
                type="button"
                role="radio"
                :aria-checked="v.id === selectedId"
                class="rounded-xl border-2 px-4 py-2 text-start text-sm transition"
                :class="[
                  v.id === selectedId
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                  !v.inStock && 'border-dashed text-slate-400',
                ]"
                @click="selectedId = v.id"
              >
                <span class="block font-medium" :class="!v.inStock && 'line-through'">{{ v.title }}</span>
                <span v-if="hasPriceRange" class="block text-xs" :class="v.id === selectedId ? 'text-brand-700' : 'text-slate-500'">
                  {{ v.inStock ? formatPrice(v.price) : 'ناموجود' }}
                </span>
              </button>
            </div>
          </div>

          <div v-if="selected" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span class="flex items-center gap-1.5" :class="selected.inStock ? 'text-emerald-700' : 'text-slate-500'">
              <span class="size-2 rounded-full" :class="selected.inStock ? 'bg-emerald-500' : 'bg-slate-400'" />
              {{ selected.inStock ? 'موجود' : 'ناموجود' }}
            </span>
            <span v-if="selected.sku" class="text-xs text-slate-500">
              کد محصول: <span class="tech">{{ selected.sku }}</span>
            </span>
          </div>

          <AddToCart :variant="selected" sticky />
        </div>

        <section v-if="product.description" class="card space-y-2 !p-5 sm:!p-6">
          <h2 class="text-lg font-bold">توضیحات محصول</h2>
          <p class="whitespace-pre-line leading-8 text-slate-700">{{ product.description }}</p>
        </section>
      </div>
    </div>

    <section v-if="related.length" class="space-y-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-3 text-xl font-extrabold sm:text-2xl">
          <span class="h-6 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
          محصولات مرتبط
        </h2>
        <NuxtLink
          v-if="product.category"
          :to="`/categories/${encodeURIComponent(product.category.slug)}`"
          class="flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:gap-2"
        >
          مشاهده‌ی همه
          <StoreIcon name="chevronLeft" :size="16" />
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in related" :key="p.id" :product="p" />
      </div>
    </section>
  </div>
</template>
