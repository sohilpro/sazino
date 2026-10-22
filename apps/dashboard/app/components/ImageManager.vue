<script setup lang="ts">
import type { ImageDto, MediaDto } from '@myapp/shared-types';

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const images = defineModel<ImageDto[]>({ required: true });
/** والد با این مقدار می‌فهمد آپلودی در جریان است */
const busy = defineModel<boolean>('busy', { default: false });

const api = useApi();
const toast = useToast();

const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const pending = ref(0);

async function addFiles(list: FileList | null) {
  const files = Array.from(list ?? []);
  if (!files.length) return;

  if (busy.value) {
    toast.info('تا پایان آپلود قبلی صبر کنید');
    return;
  }

  const room = MAX_IMAGES - images.value.length;
  if (room <= 0) {
    toast.error(`حداکثر ${formatNumber(MAX_IMAGES)} تصویر برای هر محصول مجاز است`);
    return;
  }
  if (files.length > room) toast.info(`فقط ${formatNumber(room)} تصویر اول اضافه شد`);

  busy.value = true;
  try {
    for (const file of files.slice(0, room)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`«${file.name}»: فقط JPEG، PNG، WebP و GIF مجاز است`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`«${file.name}» بزرگ‌تر از ۵ مگابایت است`);
        continue;
      }

      pending.value++;
      try {
        const body = new FormData();
        body.append('file', file);
        const media = await api<MediaDto>('/media', { method: 'POST', body });
        images.value = [...images.value, media];
      } catch (e) {
        toast.error(`«${file.name}»: ${apiErrorMessage(e)}`);
      } finally {
        pending.value--;
      }
    }
  } finally {
    busy.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onPick(e: Event) {
  void addFiles((e.target as HTMLInputElement).files);
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  void addFiles(e.dataTransfer?.files ?? null);
}

function move(index: number, dir: -1 | 1) {
  const target = index + dir;
  if (target < 0 || target >= images.value.length) return;
  const next = [...images.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  images.value = next;
}

function removeAt(index: number) {
  images.value = images.value.filter((_, i) => i !== index);
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <div
        v-for="(img, i) in images"
        :key="img.id"
        class="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      >
        <img
          :src="img.urls.sm"
          :alt="img.alt ?? ''"
          class="aspect-square w-full object-cover"
          loading="lazy"
        />
        <span v-if="i === 0" class="badge absolute start-2 top-2 bg-brand-600 text-white">اصلی</span>

        <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 p-1.5">
          <div class="flex gap-1">
            <button
              type="button"
              class="rounded bg-white/90 px-2 text-sm disabled:opacity-40"
              :disabled="i === 0"
              aria-label="انتقال به قبل"
              @click="move(i, -1)"
            >
              →
            </button>
            <button
              type="button"
              class="rounded bg-white/90 px-2 text-sm disabled:opacity-40"
              :disabled="i === images.length - 1"
              aria-label="انتقال به بعد"
              @click="move(i, 1)"
            >
              ←
            </button>
          </div>
          <button
            type="button"
            class="rounded bg-red-600 px-2 text-sm text-white"
            aria-label="جدا کردن از محصول"
            @click="removeAt(i)"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        v-for="n in pending"
        :key="`pending-${n}`"
        class="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500"
      >
        در حال آپلود…
      </div>

      <button
        v-if="images.length + pending < MAX_IMAGES"
        type="button"
        class="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm transition"
        :class="
          dragging
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-600'
        "
        @click="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <span class="text-2xl leading-none">+</span>
        <span>افزودن تصویر</span>
        <span class="text-xs">یا فایل را اینجا رها کنید</span>
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onPick"
    />

    <p class="text-xs text-slate-500">
      JPEG، PNG، WebP، GIF — حداکثر ۵ مگابایت. تصویر اول، تصویر اصلی محصول است (در ترتیب راست‌به‌چپ،
      → یعنی «قبل‌تر»). حذف، فقط تصویر را از همین محصول جدا می‌کند. تغییرات با «ذخیره» اعمال می‌شود.
    </p>
  </div>
</template>