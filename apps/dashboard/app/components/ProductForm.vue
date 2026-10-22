<script setup lang="ts">
import type { CategoryDto, ImageDto, ProductDto, ProductStatus } from '@myapp/shared-types';
import type { VariantForm } from '~/utils/variant-form';

const props = defineProps<{ product?: ProductDto }>();
const emit = defineEmits<{ saved: [product: ProductDto] }>();

const SLUG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

const api = useApi();
const toast = useToast();

const isEdit = Boolean(props.product);
/** آخرین نسخه‌ی ذخیره‌شده‌ی محصول (فقط برای نمایش و مقایسه) */
const current = ref<ProductDto | undefined>(props.product);

const form = reactive({
  title: props.product?.title ?? '',
  slug: props.product?.slug ?? '',
  description: props.product?.description ?? '',
  status: (props.product?.status ?? 'DRAFT') as ProductStatus,
  categoryId: props.product?.category?.id ?? '',
});

const idsKey = (list: ImageDto[]) => list.map((i) => i.id).join(',');
const images = ref<ImageDto[]>(props.product ? [...props.product.images] : []);
const imagesBaseline = ref(idsKey(images.value));
const uploading = ref(false);

const variants = ref<VariantForm[]>(
  props.product ? props.product.variants.map(variantFromDto) : [emptyVariant()],
);

const saving = ref(false);
const formError = ref('');

// ───────────── دسته‌بندی‌ها ─────────────
const { data: categories } = useLazyAsyncData('category-options', () =>
  api<CategoryDto[]>('/categories'),
);

const categoryOptions = computed(() => {
  const all = categories.value ?? [];
  return all
    .filter((c) => !c.parentId)
    .flatMap((root) => [
      { id: root.id, label: root.name },
      ...all
        .filter((c) => c.parentId === root.id)
        .map((c) => ({ id: c.id, label: `${root.name} ‹ ${c.name}` })),
    ]);
});

// ───────────── اعتبارسنجی ─────────────
function validate(): string | null {
  const title = form.title.trim();
  if (title.length < 2) return 'عنوان محصول باید حداقل ۲ کاراکتر باشد';
  if (title.length > 200) return 'عنوان محصول نباید بیشتر از ۲۰۰ کاراکتر باشد';

  const slug = form.slug.trim().toLowerCase();
  if (slug && (slug.length > 80 || !SLUG_RE.test(slug))) {
    return 'slug فقط می‌تواند شامل حروف، عدد و خط تیره باشد (حداکثر ۸۰ کاراکتر)';
  }

  if (form.description.length > 20_000) return 'توضیحات بیش از حد طولانی است';

  if (!isEdit) {
    if (!variants.value.length) return 'حداقل یک تنوع لازم است';
    for (const [i, v] of variants.value.entries()) {
      const error = validateVariant(v);
      if (error) return `تنوع ${formatNumber(i + 1)}: ${error}`;
    }
    const skus = variants.value.map((v) => v.sku.trim()).filter(Boolean);
    if (new Set(skus).size !== skus.length) return 'SKU تنوع‌ها باید یکتا باشد';
  }
  return null;
}

// ───────────── ذخیره ─────────────
async function save() {
  formError.value = '';
  const error = validate();
  if (error) {
    formError.value = error;
    return;
  }

  saving.value = true;
  try {
    if (isEdit) await saveEdit();
    else await saveCreate();
  } catch (e) {
    formError.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function saveCreate() {
  const slug = form.slug.trim().toLowerCase();

  const created = await api<ProductDto>('/products', {
    method: 'POST',
    body: {
      title: form.title.trim(),
      slug: slug || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
      categoryId: form.categoryId || undefined,
      variants: variants.value.map((v) => toCreateVariantPayload(v)),
    },
  });

  let result = created;
  if (images.value.length) {
    try {
      result = await api<ProductDto>(`/products/${created.id}/images`, {
        method: 'PUT',
        body: { mediaIds: images.value.map((i) => i.id) },
      });
    } catch (e) {
      toast.error(`محصول ساخته شد اما ذخیره‌ی تصاویر ناموفق بود: ${apiErrorMessage(e)}`);
      emit('saved', created);
      return;
    }
  }

  toast.success('محصول ساخته شد');
  emit('saved', result);
}

async function saveEdit() {
  const base = current.value!;
  const slug = form.slug.trim().toLowerCase();

  let result = await api<ProductDto>(`/products/${base.id}`, {
    method: 'PATCH',
    body: {
      title: form.title.trim(),
      // slug فقط وقتی عوض شده ارسال می‌شود
      slug: slug && slug !== base.slug ? slug : undefined,
      description: form.description.trim() || null,
      status: form.status,
      categoryId: form.categoryId || null,
    },
  });
  current.value = result;
  form.slug = result.slug;

  if (idsKey(images.value) !== imagesBaseline.value) {
    result = await api<ProductDto>(`/products/${base.id}/images`, {
      method: 'PUT',
      body: { mediaIds: images.value.map((i) => i.id) },
    });
    imagesBaseline.value = idsKey(images.value);
    current.value = result;
  }

  toast.success('تغییرات ذخیره شد');
  emit('saved', result);
}

function onVariantsSaved(product: ProductDto) {
  current.value = product;
  emit('saved', product);
}

/** Enter داخل فیلدها فرم را ارسال نکند (در ویرایش، ردیف تنوع دکمه‌ی خودش را دارد) */
function blockEnterSubmit(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
}
</script>

<template>
  <form class="grid gap-6 lg:grid-cols-3" novalidate @submit.prevent="save" @keydown.enter="blockEnterSubmit">
    <div class="space-y-6 lg:col-span-2">
      <section class="card space-y-4">
        <h2 class="text-lg font-bold">اطلاعات اصلی</h2>

        <label class="block">
          <span class="label">عنوان محصول</span>
          <input
            v-model="form.title"
            class="input"
            maxlength="200"
            placeholder="مثلاً: تیشرت نخی مردانه"
          />
        </label>

        <label class="block">
          <span class="label">نشانی صفحه (slug)</span>
          <input
            v-model="form.slug"
            dir="ltr"
            class="input"
            maxlength="80"
            :placeholder="isEdit ? '' : 'اگر خالی بماند از روی عنوان ساخته می‌شود'"
          />
          <span v-if="isEdit" class="mt-1 block text-xs text-amber-600">
            با تغییر slug، آدرس قبلی صفحه‌ی محصول دیگر کار نمی‌کند.
          </span>
        </label>

        <label class="block">
          <span class="label">توضیحات</span>
          <textarea v-model="form.description" rows="6" class="input" maxlength="20000" />
        </label>
      </section>

      <section class="card space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold">تصاویر</h2>
          <span class="text-xs text-slate-500">{{ formatNumber(images.length) }} از ۱۰</span>
        </div>
        <ImageManager v-model="images" v-model:busy="uploading" />
      </section>

      <section class="card space-y-4">
        <h2 class="text-lg font-bold">قیمت، تنوع‌ها و موجودی</h2>
        <VariantsEditor v-model="variants" :product-id="current?.id" @saved="onVariantsSaved" />
      </section>
    </div>

    <aside>
      <div class="card space-y-4 lg:sticky lg:top-6">
        <label class="block">
          <span class="label">وضعیت</span>
          <select v-model="form.status" class="input">
            <option v-for="o in PRODUCT_STATUS_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
          <span class="mt-1 block text-xs text-slate-500">
            فقط محصولات «فعال» در ویترین نمایش داده می‌شوند.
          </span>
        </label>

        <label class="block">
          <span class="label">دسته‌بندی</span>
          <select v-model="form.categoryId" class="input">
            <option value="">— بدون دسته‌بندی —</option>
            <option v-for="o in categoryOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
          <NuxtLink to="/categories" class="mt-1 block text-xs text-brand-600 hover:underline">
            مدیریت دسته‌بندی‌ها
          </NuxtLink>
        </label>

        <div v-if="current" class="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <div>{{ formatPriceRange(current.minPrice, current.maxPrice) }}</div>
          <div>ایجاد: {{ formatDate(current.createdAt) }}</div>
        </div>

        <p v-if="formError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {{ formError }}
        </p>

        <div class="flex gap-2">
          <button type="submit" class="btn btn-primary flex-1" :disabled="saving || uploading">
            {{
              saving ? 'در حال ذخیره…' : uploading ? 'منتظر آپلود…' : isEdit ? 'ذخیره‌ی محصول' : 'ساخت محصول'
            }}
          </button>
          <NuxtLink to="/products" class="btn btn-secondary">انصراف</NuxtLink>
        </div>
      </div>
    </aside>
  </form>
</template>