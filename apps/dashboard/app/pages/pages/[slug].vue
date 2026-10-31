<script setup lang="ts">
import type {
  CategoryDto,
  ImageDto,
  MediaDto,
  PageDto,
  PagePreviewDto,
  StoredBlock,
} from '@myapp/shared-types';
import { onBeforeRouteLeave } from 'vue-router';
import type { BlockType } from '~/utils/blocks';

const route = useRoute();
const api = useApi();
const toast = useToast();

const slug = String(route.params.slug);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found', fatal: true });
}

// ───────────── حالت ادیتور ─────────────
const page = ref<PageDto | null>(null);
const title = ref('');
const blocks = ref<StoredBlock[]>([]);
const images = ref<Record<string, ImageDto>>({});
const savedSignature = ref('');
const open = ref(new Set<string>());

function apply(dto: PageDto) {
  page.value = dto;
  title.value = dto.title;
  blocks.value = JSON.parse(JSON.stringify(dto.draftBlocks ?? dto.blocks)) as StoredBlock[];
  images.value = { ...images.value, ...dto.images };
  savedSignature.value = contentSignature(title.value, blocks.value);
}

// ۴۰۴ یعنی صفحه هنوز ساخته نشده؛ با ذخیره ساخته می‌شود
const { data, error } = await useAsyncData(`page-edit-${slug}`, async () => {
  try {
    return await api<PageDto>(`/pages/${slug}`);
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
});

if (data.value) {
  apply(data.value);
} else {
  title.value = firstQueryValue(route.query.title);
  savedSignature.value = contentSignature('', []);
}

function firstQueryValue(v: unknown): string {
  const first = Array.isArray(v) ? v[0] : v;
  return typeof first === 'string' ? first.slice(0, 120) : '';
}

const { data: categories } = useLazyAsyncData('editor-categories', () => api<CategoryDto[]>('/categories'));
const categoryOptions = computed(() => {
  const all = categories.value ?? [];
  return all
    .filter((c) => !c.parentId)
    .flatMap((root) => [
      { slug: root.slug, label: root.name },
      ...all.filter((c) => c.parentId === root.id).map((c) => ({ slug: c.slug, label: `${root.name} ‹ ${c.name}` })),
    ]);
});

// ───────────── وضعیت ─────────────
const isNew = computed(() => page.value === null);
const isDefaultHome = computed(() => page.value?.isDefault === true);
const dirty = computed(() => contentSignature(title.value, blocks.value) !== savedSignature.value);
const validation = computed(() => validateBlocks(blocks.value));
const titleError = computed(() => (title.value.trim().length < 2 ? 'عنوان صفحه باید حداقل ۲ کاراکتر باشد' : ''));
const hasUnpublished = computed(
  () => dirty.value || isNew.value || isDefaultHome.value || page.value?.hasUnpublishedChanges === true,
);

const saving = ref(false);
const publishing = ref(false);
const busy = computed(() => saving.value || publishing.value);
const serverErrors = ref<string[]>([]);
const previewUrl = ref('');

// ───────────── عملیات بلاک ─────────────
const isOpen = (id: string) => open.value.has(id);
function toggle(id: string) {
  if (open.value.has(id)) open.value.delete(id);
  else open.value.add(id);
}

function addBlock(type: BlockType) {
  if (blocks.value.length >= MAX_BLOCKS) return toast.error(`حداکثر ${MAX_BLOCKS} بلاک در هر صفحه مجاز است`);
  const block = createBlock(type);
  blocks.value.push(block);
  open.value.add(block.id);
}

function move(index: number, direction: -1 | 1) {
  blocks.value = moveBlock(blocks.value, index, index + direction);
}

function duplicate(index: number) {
  if (blocks.value.length >= MAX_BLOCKS) return toast.error(`حداکثر ${MAX_BLOCKS} بلاک در هر صفحه مجاز است`);
  const copy = cloneBlock(blocks.value[index]!);
  blocks.value.splice(index + 1, 0, copy);
  open.value.add(copy.id);
}

function removeBlock(index: number) {
  if (!confirm('این بلاک حذف شود؟')) return;
  blocks.value.splice(index, 1);
}

// ───────────── تصویر بنر ─────────────
const pickerOpen = ref(false);
const pickerTarget = ref<string | null>(null);

function chooseImage(blockId: string) {
  pickerTarget.value = blockId;
  pickerOpen.value = true;
}

function onImagePicked(media: MediaDto) {
  const block = blocks.value.find((b) => b.id === pickerTarget.value);
  if (block?.type === 'hero') {
    block.props.imageId = media.id;
    images.value = { ...images.value, [media.id]: media };
  }
}

function clearImage(blockId: string) {
  const block = blocks.value.find((b) => b.id === blockId);
  if (block?.type === 'hero') block.props.imageId = null;
}

const imageOf = (block: StoredBlock): ImageDto | null =>
  block.type === 'hero' && block.props.imageId ? (images.value[block.props.imageId] ?? null) : null;

// ───────────── ذخیره، انتشار، پیش‌نمایش ─────────────
function checkBeforeSave(): boolean {
  if (titleError.value) {
    toast.error(titleError.value);
    return false;
  }
  if (!validation.value.valid) {
    toast.error('ابتدا خطاهای مشخص‌شده را برطرف کنید');
    return false;
  }
  return true;
}

async function save(): Promise<boolean> {
  if (!checkBeforeSave()) return false;

  saving.value = true;
  serverErrors.value = [];
  try {
    apply(
      await api<PageDto>(`/pages/${slug}`, {
        method: 'PUT',
        body: { title: title.value.trim(), blocks: blocks.value.map(normalizeBlock) },
      }),
    );
    toast.success('پیش‌نویس ذخیره شد');
    return true;
  } catch (e) {
    serverErrors.value = apiErrorMessages(e);
    toast.error('ذخیره‌ی پیش‌نویس ناموفق بود');
    return false;
  } finally {
    saving.value = false;
  }
}

async function publish() {
  if (blocks.value.length === 0) return void toast.error('صفحه‌ی بدون بلاک منتشر نمی‌شود');
  if (!confirm('تغییرات برای همه‌ی بازدیدکنندگان منتشر شود؟')) return;
  if ((dirty.value || isNew.value || isDefaultHome.value) && !(await save())) return;

  publishing.value = true;
  try {
    apply(await api<PageDto>(`/pages/${slug}/publish`, { method: 'POST' }));
    toast.success('صفحه منتشر شد');
  } catch (e) {
    if (codeOf(e) === 'NOTHING_TO_PUBLISH') toast.info('تغییر منتشرنشده‌ای وجود ندارد');
    else toast.error(apiErrorMessage(e));
  } finally {
    publishing.value = false;
  }
}

async function discard() {
  if (!confirm('تغییرات پیش‌نویس دور ریخته شود و به نسخه‌ی منتشرشده برگردد؟')) return;
  try {
    if (page.value?.draftBlocks) {
      apply(await api<PageDto>(`/pages/${slug}/draft`, { method: 'DELETE' }));
    } else if (page.value) {
      apply(page.value);
    }
    serverErrors.value = [];
    toast.success('تغییرات دور ریخته شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}

async function openPreview() {
  // پنجره همزمان با کلیک باز می‌شود تا مرورگر آن را مسدود نکند
  const win = window.open('about:blank', '_blank');
  if (win) win.opener = null;

  try {
    if ((dirty.value || isNew.value) && !(await save())) {
      win?.close();
      return;
    }
    const res = await api<PagePreviewDto>(`/pages/${slug}/preview`, { method: 'POST' });
    previewUrl.value = res.url;
    if (win) win.location.href = res.url;
    else toast.info('پنجره‌ی پیش‌نمایش مسدود شد؛ از پیوند پایین صفحه استفاده کنید');
  } catch (e) {
    win?.close();
    toast.error(apiErrorMessage(e));
  }
}

// ───────────── خروج با تغییرات ذخیره‌نشده ─────────────
onBeforeRouteLeave(() => !dirty.value || confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟'));

function warnBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return;
  e.preventDefault();
  e.returnValue = '';
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload));
useHead({ title: () => `ویرایش صفحه: ${title.value || slug}` });
</script>

<template>
  <div class="max-w-4xl space-y-6 pb-24">
    <header class="space-y-1">
      <NuxtLink to="/pages" class="text-sm text-slate-500 hover:text-brand-600">→ صفحات</NuxtLink>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-extrabold">{{ slug === 'home' ? 'صفحه‌ی اصلی' : `صفحه: ${slug}` }}</h1>
        <span v-if="dirty" class="badge bg-amber-100 text-amber-700">تغییرات ذخیره‌نشده</span>
        <span v-else-if="page?.hasUnpublishedChanges" class="badge bg-sky-100 text-sky-700">پیش‌نویس منتشرنشده</span>
        <span v-else-if="page?.publishedAt" class="badge bg-emerald-100 text-emerald-700">منتشرشده</span>
      </div>
    </header>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else>
      <p v-if="isDefaultHome" class="rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
        این صفحه‌ی اصلی پیش‌فرض است. با ذخیره‌ی تغییرات، صفحه‌ی اصلی خودتان ساخته می‌شود و با «انتشار» جای پیش‌فرض را می‌گیرد.
      </p>
      <p v-else-if="isNew" class="rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
        این صفحه هنوز ساخته نشده است. بلاک‌ها را بچینید و ذخیره کنید.
      </p>

      <section class="card space-y-2">
        <label class="block">
          <span class="label">عنوان صفحه</span>
          <input v-model="title" class="input" maxlength="120" />
        </label>
        <p v-if="titleError" class="text-sm text-red-700">{{ titleError }}</p>
      </section>

      <section v-if="validation.global.length || serverErrors.length" class="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
        <ul class="list-disc space-y-1 ps-5 text-sm text-red-700">
          <li v-for="m in [...validation.global, ...serverErrors]" :key="m">{{ m }}</li>
        </ul>
      </section>

      <!-- بلاک‌ها -->
      <section class="space-y-3">
        <p v-if="!blocks.length" class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          هنوز بلاکی ندارید. از پایین یک بلاک اضافه کنید.
        </p>

        <article
          v-for="(b, i) in blocks"
          :key="b.id"
          class="card space-y-4"
          :class="validation.byIndex[i] ? 'border-red-300' : ''"
        >
          <header class="flex items-center justify-between gap-2">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-start"
              :aria-expanded="isOpen(b.id)"
              @click="toggle(b.id)"
            >
              <span class="badge bg-brand-50 text-brand-700">{{ formatNumber(i + 1) }}</span>
              <span class="font-medium">{{ blockLabel(b.type) }}</span>
              <span class="truncate text-sm text-slate-500">{{ blockSummary(b) }}</span>
            </button>

            <div class="flex shrink-0 gap-1">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="i === 0" aria-label="انتقال به بالا" @click="move(i, -1)">↑</button>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="i === blocks.length - 1" aria-label="انتقال به پایین" @click="move(i, 1)">↓</button>
              <button type="button" class="btn btn-secondary btn-sm" aria-label="تکثیر" @click="duplicate(i)">⧉</button>
              <button type="button" class="btn btn-secondary btn-sm text-red-600" aria-label="حذف" @click="removeBlock(i)">✕</button>
            </div>
          </header>

          <ul v-if="validation.byIndex[i]" class="list-disc space-y-1 ps-5 text-sm text-red-700">
            <li v-for="m in validation.byIndex[i]" :key="m">{{ m }}</li>
          </ul>

          <BlockEditor
            v-if="isOpen(b.id)"
            :model-value="b"
            :categories="categoryOptions"
            :image="imageOf(b)"
            @update:model-value="(v) => (blocks[i] = v)"
            @choose-image="chooseImage(b.id)"
            @clear-image="clearImage(b.id)"
          />
        </article>
      </section>

      <!-- افزودن بلاک -->
      <section class="card space-y-3">
        <h2 class="text-lg font-bold">افزودن بلاک</h2>
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="t in BLOCK_TYPES"
            :key="t.type"
            type="button"
            class="rounded-xl border border-slate-200 p-3 text-start transition hover:border-brand-500 hover:bg-brand-50"
            @click="addBlock(t.type)"
          >
            <div class="font-medium">+ {{ t.label }}</div>
            <div class="text-xs text-slate-500">{{ t.description }}</div>
          </button>
        </div>
      </section>

      <p v-if="previewUrl" class="text-sm">
        پیوند پیش‌نمایش (۳۰ دقیقه معتبر):
        <a :href="previewUrl" target="_blank" rel="noopener" class="text-brand-600 underline">باز کردن</a>
      </p>

      <!-- نوار عملیات -->
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:start-60">
        <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm text-red-600"
            :disabled="busy || (!dirty && !page?.draftBlocks)"
            @click="discard"
          >
            دور انداختن تغییرات
          </button>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="openPreview">پیش‌نمایش</button>
            <button type="button" class="btn btn-secondary" :disabled="busy || !dirty" @click="save">
              {{ saving ? 'در حال ذخیره…' : 'ذخیره‌ی پیش‌نویس' }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="busy || !hasUnpublished || !blocks.length" @click="publish">
              {{ publishing ? 'در حال انتشار…' : 'انتشار' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <MediaPicker v-model:open="pickerOpen" @select="onImagePicked" />
  </div>
</template>