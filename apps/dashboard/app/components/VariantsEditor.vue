<script setup lang="ts">
import type { ProductDto, VariantDto } from '@myapp/shared-types';
import type { VariantForm } from '~/utils/variant-form';

const props = defineProps<{ productId?: string }>();
const emit = defineEmits<{ saved: [product: ProductDto] }>();
const rows = defineModel<VariantForm[]>({ required: true });

const api = useApi();
const toast = useToast();
const { canDelete } = useAuth();

const isEdit = computed(() => Boolean(props.productId));
const busyKey = ref<string | null>(null);

const asNumber = (raw: string): number | null => {
  const n = parseIntField(raw);
  return n === null || Number.isNaN(n) ? null : n;
};
/** درصد تخفیف از روی «قبل از تخفیف» و قیمت فروش (فقط وقتی هر دو معتبرند) */
function discountPercent(v: VariantForm): number | null {
  const price = asNumber(v.price);
  const compare = asNumber(v.compareAtPrice);
  return price && compare && compare > price ? Math.round((1 - price / compare) * 100) : null;
}
const pricePreview = (v: VariantForm) => {
  const n = asNumber(v.price);
  return n ? formatPrice(n) : '';
};

function addRow() {
  if (rows.value.length >= MAX_VARIANTS) {
    toast.error(`هر محصول حداکثر ${formatNumber(MAX_VARIANTS)} تنوع دارد`);
    return;
  }
  rows.value = [...rows.value, emptyVariant()];
}

/** فقط ردیف ذخیره‌شده با داده‌ی سرور جایگزین می‌شود؛ ویرایش‌های ذخیره‌نشده‌ی بقیه‌ی ردیف‌ها حفظ می‌شود */
function replaceRow(key: string, server: VariantDto | undefined) {
  if (!server) return;
  rows.value = rows.value.map((r) => (r.key === key ? { ...variantFromDto(server), key } : r));
}

async function saveRow(v: VariantForm) {
  const error = validateVariant(v);
  if (error) {
    toast.error(error);
    return;
  }

  busyKey.value = v.key;
  try {
    let product: ProductDto;
    let saved: VariantDto | undefined;

    if (v.id) {
      await api<ProductDto>(`/products/${props.productId}/variants/${v.id}`, {
        method: 'PATCH',
        body: toUpdateVariantPayload(v),
      });
      product = await api<ProductDto>(`/products/${props.productId}/variants/${v.id}/inventory`, {
        method: 'PATCH',
        body: toInventoryPayload(v),
      });
      saved = product.variants.find((s) => s.id === v.id);
    } else {
      const knownIds = new Set(rows.value.map((r) => r.id).filter(Boolean));
      product = await api<ProductDto>(`/products/${props.productId}/variants`, {
        method: 'POST',
        body: toCreateVariantPayload(v),
      });
      saved = product.variants.find((s) => !knownIds.has(s.id));
    }

    replaceRow(v.key, saved);
    toast.success('تنوع ذخیره شد');
    emit('saved', product);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    busyKey.value = null;
  }
}

async function removeRow(v: VariantForm) {
  if (rows.value.length <= 1) return;

  // ردیف ذخیره‌نشده (یا حالت ایجاد): فقط از فرم حذف می‌شود
  if (!props.productId || !v.id) {
    rows.value = rows.value.filter((r) => r.key !== v.key);
    return;
  }

  if (!confirm('این تنوع حذف شود؟ موجودی آن هم پاک می‌شود.')) return;

  busyKey.value = v.key;
  try {
    const product = await api<ProductDto>(`/products/${props.productId}/variants/${v.id}`, {
      method: 'DELETE',
    });
    rows.value = rows.value.filter((r) => r.key !== v.key);
    toast.success('تنوع حذف شد');
    emit('saved', product);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    busyKey.value = null;
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="isEdit" class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
      در ویرایش، تغییر هر تنوع با دکمه‌ی «ذخیره‌ی تنوع» همان ردیف اعمال می‌شود (جدا از «ذخیره‌ی محصول»).
    </p>

    <div
      v-for="(v, i) in rows"
      :key="v.key"
      class="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="grid size-6 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {{ formatNumber(i + 1) }}
          </span>
          <span class="text-sm font-semibold text-slate-700">{{ v.title.trim() || 'تنوع بدون عنوان' }}</span>
          <span v-if="isEdit && !v.id" class="badge bg-amber-100 text-amber-700">ذخیره‌نشده</span>
          <span v-if="discountPercent(v)" class="badge bg-rose-100 text-rose-700">
            {{ formatNumber(discountPercent(v)!) }}٪ تخفیف
          </span>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm !px-2 text-red-600 hover:!bg-red-50"
          :disabled="rows.length <= 1 || busyKey === v.key || (isEdit && Boolean(v.id) && !canDelete)"
          :title="isEdit && v.id && !canDelete ? 'فقط مالک و مدیر می‌توانند تنوع را حذف کنند' : 'حذف تنوع'"
          aria-label="حذف تنوع"
          @click="removeRow(v)"
        >
          <AppIcon name="trash" :size="16" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-6">
        <label class="col-span-2 block">
          <span class="label">عنوان تنوع</span>
          <input v-model="v.title" class="input" maxlength="100" placeholder="مثلاً: سایز M" />
        </label>
        <label class="col-span-2 block">
          <span class="label">SKU</span>
          <input v-model="v.sku" dir="ltr" class="input tech" maxlength="64" />
        </label>
        <label class="block">
          <span class="label">قیمت (تومان)</span>
          <input v-model="v.price" inputmode="numeric" dir="ltr" class="input" />
          <span v-if="pricePreview(v)" class="hint">{{ pricePreview(v) }}</span>
        </label>
        <label class="block">
          <span class="label">قبل از تخفیف</span>
          <input v-model="v.compareAtPrice" inputmode="numeric" dir="ltr" class="input" />
        </label>
        <label class="block">
          <span class="label">موجودی</span>
          <input v-model="v.quantity" inputmode="numeric" dir="ltr" class="input" />
        </label>
        <label class="col-span-2 flex items-center gap-2 self-end pb-2 text-sm md:col-span-5">
          <input v-model="v.allowBackorder" type="checkbox" class="size-4 accent-brand-600" />
          فروش با موجودی صفر (پیش‌سفارش)
        </label>
      </div>

      <div v-if="isEdit" class="mt-3 flex justify-end">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="busyKey === v.key"
          @click="saveRow(v)"
        >
          {{ busyKey === v.key ? 'در حال ذخیره…' : v.id ? 'ذخیره‌ی تنوع' : 'افزودن تنوع' }}
        </button>
      </div>
    </div>

    <button type="button" class="btn btn-secondary" @click="addRow">
      <AppIcon name="plus" :size="16" />
      افزودن تنوع
    </button>
  </div>
</template>
