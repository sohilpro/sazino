<script setup lang="ts">
import type { MediaDto, Paginated } from '@myapp/shared-types';

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ select: [media: MediaDto] }>();

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const api = useApi();
const toast = useToast();

const items = ref<MediaDto[]>([]);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

async function load() {
  loading.value = true;
  try {
    const res = await api<Paginated<MediaDto>>('/media', { query: { page: page.value, limit: 18 } });
    items.value = res.items;
    totalPages.value = Math.max(res.meta.totalPages, 1);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  page.value = 1;
  void load();
});
watch(page, () => {
  if (open.value) void load();
});

function choose(media: MediaDto) {
  emit('select', media);
  open.value = false;
}

async function upload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  if (!ACCEPTED.includes(file.type)) return toast.error('فقط JPEG، PNG، WebP و GIF مجاز است');
  if (file.size > MAX_BYTES) return toast.error('حجم تصویر بیشتر از ۵ مگابایت است');

  uploading.value = true;
  try {
    const body = new FormData();
    body.append('file', file);
    choose(await api<MediaDto>('/media', { method: 'POST', body }));
  } catch (err) {
    toast.error(apiErrorMessage(err));
  } finally {
    uploading.value = false;
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) open.value = false;
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="انتخاب تصویر"
    @click.self="open = false"
  >
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
      <header class="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 class="text-lg font-bold">انتخاب تصویر</h2>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-primary btn-sm" :disabled="uploading" @click="fileInput?.click()">
            {{ uploading ? 'در حال آپلود…' : 'آپلود تصویر جدید' }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" aria-label="بستن" @click="open = false">✕</button>
        </div>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="upload" />
      </header>

      <div class="overflow-y-auto p-4">
        <p v-if="loading && !items.length" class="py-10 text-center text-slate-500">در حال بارگذاری…</p>
        <p v-else-if="!items.length" class="py-10 text-center text-slate-500">
          هنوز تصویری آپلود نکرده‌اید.
        </p>
        <ul v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          <li v-for="m in items" :key="m.id">
            <button
              type="button"
              class="block w-full overflow-hidden rounded-lg border border-slate-200 transition hover:border-brand-500 hover:ring-2 hover:ring-brand-500/30"
              :aria-label="`انتخاب ${m.originalName}`"
              @click="choose(m)"
            >
              <img :src="m.urls.thumb" :alt="m.alt ?? m.originalName" class="aspect-square w-full object-cover" loading="lazy" />
            </button>
          </li>
        </ul>
      </div>

      <footer v-if="totalPages > 1" class="flex items-center justify-center gap-3 border-t border-slate-200 p-3 text-sm">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="page <= 1" @click="page--">قبلی</button>
        <span>{{ formatNumber(page) }} از {{ formatNumber(totalPages) }}</span>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="page >= totalPages" @click="page++">
          بعدی
        </button>
      </footer>
    </div>
  </div>
</template>