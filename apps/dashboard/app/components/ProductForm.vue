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

const STATUS_HINT: Record<ProductStatus, string> = {
  DRAFT: 'فقط برای شما قابل مشاهده است',
  ACTIVE: 'در ویترین نمایش داده می‌شود',
  ARCHIVED: 'از ویترین برداشته می‌شود و اطلاعاتش حفظ می‌شود',
};

const submitLabel = computed(() =>
  saving.value ? 'در حال ذخیره…' : uploading.value ? 'منتظر آپلود…' : isEdit ? 'ذخیره‌ی محصول' : 'ساخت محصول',
);

/** Enter داخل فیلدها فرم را ارسال نکند (در ویرایش، ردیف تنوع دکمه‌ی خودش را دارد) */
function blockEnterSubmit(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
}
</script>

<template>
  <form
    class="grid gap-6 pb-24 lg:grid-cols-3 lg:pb-0"
    novalidate
    @submit.prevent="save"
    @keydown.enter="blockEnterSubmit"
  >
    <div class="space-y-6 lg:col-span-2">
      <FormSection title="اطلاعات اصلی">
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
            class="input tech"
            maxlength="80"
            :placeholder="isEdit ? '' : 'خالی بماند، از روی عنوان ساخته می‌شود'"
          />
          <span v-if="isEdit" class="hint !text-amber-600">
            با تغییر slug، آدرس قبلی صفحه‌ی محصول دیگر کار نمی‌کند.
          </span>
        </label>

        <label class="block">
          <span class="label">توضیحات</span>
          <textarea v-model="form.description" rows="6" class="input" maxlength="20000" />
          <span class="hint text-end">{{ formatNumber(form.description.length) }} / {{ formatNumber(20000) }}</span>
        </label>
      </FormSection>

      <FormSection
        title="تصاویر"
        description="تصویر اول، تصویر اصلی محصول در ویترین است."
      >
        <template #aside>
          <span class="badge bg-slate-100 text-slate-600">{{ formatNumber(images.length) }} از ۱۰</span>
        </template>
        <ImageManager v-model="images" v-model:busy="uploading" />
      </FormSection>

      <FormSection
        title="قیمت، تنوع‌ها و موجودی"
        description="اگر محصول تنوع ندارد، همان یک تنوع پیش‌فرض کافی است."
      >
        <VariantsEditor v-model="variants" :product-id="current?.id" @saved="onVariantsSaved" />
      </FormSection>
    </div>

    <aside>
      <div class="card space-y-5 lg:sticky lg:top-6">
        <fieldset>
          <legend class="label">وضعیت انتشار</legend>
          <div class="space-y-2">
            <label
              v-for="o in PRODUCT_STATUS_OPTIONS"
              :key="o.value"
              class="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition"
              :class="
                form.status === o.value
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              "
            >
              <input
                v-model="form.status"
                type="radio"
                name="status"
                :value="o.value"
                class="mt-1 size-4 accent-brand-600"
              />
              <span>
                <span class="block text-sm font-bold">{{ o.label }}</span>
                <span class="block text-xs text-slate-500">{{ STATUS_HINT[o.value] }}</span>
              </span>
            </label>
          </div>
        </fieldset>

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

        <dl v-if="current" class="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <div class="flex justify-between gap-2">
            <dt>قیمت</dt>
            <dd class="font-medium text-slate-700">{{ formatPriceRange(current.minPrice, current.maxPrice) }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>ایجاد</dt>
            <dd>{{ formatDate(current.createdAt) }}</dd>
          </div>
        </dl>

        <p v-if="formError" class="alert-error max-lg:hidden" role="alert">{{ formError }}</p>

        <div class="flex gap-2 max-lg:hidden">
          <button type="submit" class="btn btn-primary btn-lg flex-1" :disabled="saving || uploading">
            {{ submitLabel }}
          </button>
          <NuxtLink to="/products" class="btn btn-secondary btn-lg">انصراف</NuxtLink>
        </div>
      </div>
    </aside>

    <!-- نوار ذخیره‌ی موبایل -->
    <div class="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-slate-200 bg-white p-3 lg:hidden">
      <p v-if="formError" class="alert-error" role="alert">{{ formError }}</p>
      <div class="flex gap-2">
        <button type="submit" class="btn btn-primary btn-lg flex-1" :disabled="saving || uploading">
          {{ submitLabel }}
        </button>
        <NuxtLink to="/products" class="btn btn-secondary btn-lg">انصراف</NuxtLink>
      </div>
    </div>
  </form>
</template>
