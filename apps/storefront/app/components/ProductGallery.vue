<script setup lang="ts">
import type { ImageDto } from '@myapp/shared-types';

const props = defineProps<{ images: ImageDto[]; title: string }>();

const active = ref(0);
watch(
  () => props.images,
  () => (active.value = 0),
);

const current = computed(() => props.images[active.value]);
</script>

<template>
  <div class="space-y-3">
    <div
      class="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <a
        v-if="current"
        :href="current.urls.lg"
        target="_blank"
        rel="noopener"
        class="block size-full"
        aria-label="نمایش تصویر بزرگ‌تر"
      >
        <img
          :src="current.urls.md"
          :alt="current.alt || title"
          fetchpriority="high"
          class="size-full object-contain"
        />
      </a>
      <div v-else class="flex size-full items-center justify-center text-slate-400">بدون تصویر</div>
    </div>

    <ul v-if="images.length > 1" class="grid grid-cols-5 gap-2">
      <li v-for="(img, i) in images" :key="img.id">
        <button
          type="button"
          class="block w-full overflow-hidden rounded-lg border bg-white transition"
          :class="i === active ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-brand-500'"
          :aria-label="`نمایش تصویر ${formatNumber(i + 1)}`"
          :aria-current="i === active ? 'true' : undefined"
          @click="active = i"
        >
          <img :src="img.urls.thumb" alt="" loading="lazy" class="aspect-square w-full object-cover" />
        </button>
      </li>
    </ul>
  </div>
</template>