<script setup lang="ts">
import type { HeroBlock } from '@myapp/shared-types';

const props = defineProps<{
  block: HeroBlock;
  /** اولین بلاک صفحه h1 می‌شود (یک h1 در هر صفحه) */
  primary?: boolean;
}>();

const p = computed(() => props.block.props);
const href = computed(() => safeHref(p.value.ctaHref));
const external = computed(() => href.value?.startsWith('https://') ?? false);
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl"
    :class="p.image ? 'text-white' : 'bg-linear-to-b from-brand-50 to-white text-slate-900'"
  >
    <template v-if="p.image">
      <img
        :src="p.image.urls.lg"
        :alt="p.image.alt ?? ''"
        class="absolute inset-0 size-full object-cover"
        fetchpriority="high"
      />
      <div class="absolute inset-0 bg-black/50" aria-hidden="true" />
    </template>

    <div
      class="relative px-6 py-14 sm:px-14 sm:py-20"
      :class="p.align === 'center' ? 'text-center' : 'text-start'"
    >
      <component
        :is="primary ? 'h1' : 'h2'"
        class="text-3xl font-extrabold sm:text-4xl"
        :class="!p.image && 'text-brand-700'"
      >
        {{ p.title }}
      </component>

      <p
        v-if="p.subtitle"
        class="mt-3 max-w-xl whitespace-pre-line"
        :class="[p.align === 'center' && 'mx-auto', p.image ? 'text-white/90' : 'text-slate-600']"
      >
        {{ p.subtitle }}
      </p>

      <div v-if="p.ctaLabel && href" class="mt-6">
        <a v-if="external" :href="href" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          {{ p.ctaLabel }}
        </a>
        <NuxtLink v-else :to="href" class="btn btn-primary">{{ p.ctaLabel }}</NuxtLink>
      </div>
    </div>
  </section>
</template>