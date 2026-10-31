<script setup lang="ts">
import type { ImageDto, StoredBlock } from '@myapp/shared-types';
import { MAX_RICH_TEXT } from '~/utils/blocks';

const block = defineModel<StoredBlock>({ required: true });

defineProps<{
  categories: Array<{ slug: string; label: string }>;
  /** تصویر انتخاب‌شده‌ی بنر (برای نمایش) */
  image: ImageDto | null;
}>();

const emit = defineEmits<{ 'choose-image': []; 'clear-image': [] }>();
</script>

<template>
  <div class="space-y-4">
    <!-- بنر اصلی -->
    <template v-if="block.type === 'hero'">
      <label class="block">
        <span class="label">عنوان</span>
        <input v-model="block.props.title" class="input" maxlength="120" />
      </label>
      <label class="block">
        <span class="label">زیرعنوان (اختیاری)</span>
        <textarea v-model="block.props.subtitle" rows="2" class="input" maxlength="300" />
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="label">چیدمان متن</span>
          <select v-model="block.props.align" class="input">
            <option value="center">وسط‌چین</option>
            <option value="start">راست‌چین</option>
          </select>
        </label>

        <div>
          <span class="label">تصویر پس‌زمینه (اختیاری)</span>
          <div class="flex items-center gap-3">
            <img v-if="image" :src="image.urls.thumb" :alt="image.alt ?? ''" class="size-14 rounded-lg object-cover" />
            <div v-else class="flex size-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
              بدون تصویر
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-secondary btn-sm" @click="emit('choose-image')">
                {{ block.props.imageId ? 'تغییر' : 'انتخاب' }}
              </button>
              <button v-if="block.props.imageId" type="button" class="btn btn-secondary btn-sm" @click="emit('clear-image')">
                حذف
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="label">متن دکمه (اختیاری)</span>
          <input v-model="block.props.ctaLabel" class="input" maxlength="40" />
        </label>
        <label class="block">
          <span class="label">آدرس دکمه</span>
          <input v-model="block.props.ctaHref" class="input" dir="ltr" maxlength="500" placeholder="/products" />
          <span class="mt-1 block text-xs text-slate-500">مسیر داخلی (مثل /products یا /p/about) یا لینک https</span>
        </label>
      </div>
    </template>

    <!-- فهرست محصولات -->
    <template v-else-if="block.type === 'product-grid'">
      <label class="block">
        <span class="label">عنوان بخش (اختیاری)</span>
        <input v-model="block.props.title" class="input" maxlength="80" />
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="label">نمایش</span>
          <select v-model="block.props.source" class="input">
            <option value="latest">جدیدترین محصولات</option>
            <option value="category">محصولات یک دسته‌بندی</option>
          </select>
        </label>

        <label v-if="block.props.source === 'category'" class="block">
          <span class="label">دسته‌بندی</span>
          <select v-model="block.props.categorySlug" class="input">
            <option :value="null">— انتخاب کنید —</option>
            <option
              v-if="block.props.categorySlug && !categories.some((c) => c.slug === block.props.categorySlug)"
              :value="block.props.categorySlug"
            >
              {{ block.props.categorySlug }} (پیدا نشد)
            </option>
            <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.label }}</option>
          </select>
        </label>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="label">تعداد محصولات (۲ تا ۲۴)</span>
          <input v-model.number="block.props.limit" type="number" min="2" max="24" class="input" dir="ltr" />
        </label>
        <label class="block">
          <span class="label">تعداد ستون در دسکتاپ</span>
          <select v-model.number="block.props.columns" class="input">
            <option :value="2">۲ ستون</option>
            <option :value="3">۳ ستون</option>
            <option :value="4">۴ ستون</option>
          </select>
        </label>
      </div>
    </template>

    <!-- متن -->
    <template v-else-if="block.type === 'rich-text'">
      <label class="block">
        <span class="label">متن</span>
        <textarea v-model="block.props.content" rows="10" class="input font-mono text-[13px] leading-7" :maxlength="MAX_RICH_TEXT" />
        <span class="mt-1 flex justify-between text-xs text-slate-500">
          <span>«# عنوان» و «## زیرعنوان» · «- مورد» برای فهرست · پاراگراف‌ها را با یک خط خالی جدا کنید</span>
          <span dir="ltr">{{ block.props.content.length }} / {{ MAX_RICH_TEXT }}</span>
        </span>
      </label>
      <label class="block max-w-xs">
        <span class="label">چیدمان متن</span>
        <select v-model="block.props.align" class="input">
          <option value="start">راست‌چین</option>
          <option value="center">وسط‌چین</option>
        </select>
      </label>
    </template>
  </div>
</template>