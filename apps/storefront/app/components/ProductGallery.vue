<script setup lang="ts">
import type { ImageDto } from '@myapp/shared-types';

const props = defineProps<{ images: ImageDto[]; title: string }>();

const active = ref(0);
const lightbox = ref(false);

watch(
  () => props.images,
  () => (active.value = 0),
);

const count = computed(() => props.images.length);
const current = computed(() => props.images[active.value]);

function go(direction: -1 | 1) {
  if (count.value < 2) return;
  active.value = (active.value + direction + count.value) % count.value;
}

// در راست‌به‌چپ، فلش چپ یعنی «بعدی»
function onKeydown(e: KeyboardEvent) {
  if (!lightbox.value) return;
  if (e.key === 'Escape') lightbox.value = false;
  else if (e.key === 'ArrowLeft') go(1);
  else if (e.key === 'ArrowRight') go(-1);
}

watch(lightbox, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

const navBtn =
  'absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:bg-white hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
</script>

<template>
  <div class="space-y-3">
    <div class="relative aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <button
        v-if="current"
        type="button"
        class="block size-full cursor-zoom-in"
        aria-label="نمایش تصویر بزرگ‌تر"
        @click="lightbox = true"
      >
        <img
          :src="current.urls.md"
          :alt="current.alt || title"
          fetchpriority="high"
          class="size-full object-contain"
        />
      </button>
      <div v-else class="flex size-full items-center justify-center text-slate-300">
        <StoreIcon name="box" :size="72" />
      </div>

      <template v-if="count > 1">
        <button type="button" :class="[navBtn, 'end-3']" aria-label="تصویر بعدی" @click="go(1)">
          <StoreIcon name="chevronLeft" :size="20" />
        </button>
        <button type="button" :class="[navBtn, 'start-3']" aria-label="تصویر قبلی" @click="go(-1)">
          <StoreIcon name="chevronRight" :size="20" />
        </button>
        <span class="badge absolute bottom-3 start-3 bg-slate-900/70 text-white">
          {{ formatNumber(active + 1) }} / {{ formatNumber(count) }}
        </span>
      </template>
    </div>

    <ul v-if="count > 1" class="flex gap-2 overflow-x-auto pb-1">
      <li v-for="(img, i) in images" :key="img.id" class="w-16 shrink-0 sm:w-20">
        <button
          type="button"
          class="block w-full overflow-hidden rounded-xl border-2 bg-white transition"
          :class="i === active ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'"
          :aria-label="`نمایش تصویر ${formatNumber(i + 1)}`"
          :aria-current="i === active ? 'true' : undefined"
          @click="active = i"
        >
          <img :src="img.urls.thumb" alt="" loading="lazy" class="aspect-square w-full object-cover" />
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="lightbox && current"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="lightbox = false"
      >
        <button
          type="button"
          class="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          aria-label="بستن"
          @click="lightbox = false"
        >
          <StoreIcon name="close" />
        </button>

        <img
          :src="current.urls.lg"
          :alt="current.alt || title"
          class="max-h-[88vh] max-w-full rounded-lg object-contain"
        />

        <template v-if="count > 1">
          <button
            type="button"
            class="absolute end-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="تصویر بعدی"
            @click="go(1)"
          >
            <StoreIcon name="chevronLeft" :size="26" />
          </button>
          <button
            type="button"
            class="absolute start-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="تصویر قبلی"
            @click="go(-1)"
          >
            <StoreIcon name="chevronRight" :size="26" />
          </button>
          <span class="badge absolute bottom-4 bg-white/15 text-white">
            {{ formatNumber(active + 1) }} / {{ formatNumber(count) }}
          </span>
        </template>
      </div>
    </Teleport>
  </div>
</template>
