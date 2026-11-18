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
    class="relative isolate overflow-hidden rounded-3xl"
    :class="p.image ? 'text-white' : 'bg-brand-50 text-slate-900'"
  >
    <template v-if="p.image">
      <img
        :src="p.image.urls.lg"
        :alt="p.image.alt ?? ''"
        class="absolute inset-0 -z-10 size-full object-cover"
        fetchpriority="high"
      />
      <div class="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/45 to-black/25" aria-hidden="true" />
    </template>
    <template v-else>
      <div class="absolute -end-24 -top-24 -z-10 size-80 rounded-full bg-brand-100 blur-3xl" aria-hidden="true" />
      <div class="absolute -bottom-28 -start-16 -z-10 size-72 rounded-full bg-brand-200/60 blur-3xl" aria-hidden="true" />
    </template>

    <div
      class="px-6 py-16 sm:px-14 sm:py-24"
      :class="p.align === 'center' ? 'text-center' : 'text-start'"
    >
      <component
        :is="primary ? 'h1' : 'h2'"
        class="text-3xl font-extrabold leading-tight sm:text-5xl sm:leading-tight"
        :class="!p.image && 'text-brand-900'"
      >
        {{ p.title }}
      </component>

      <p
        v-if="p.subtitle"
        class="mt-4 max-w-xl whitespace-pre-line text-base leading-8 sm:text-lg"
        :class="[p.align === 'center' && 'mx-auto', p.image ? 'text-white/90' : 'text-slate-600']"
      >
        {{ p.subtitle }}
      </p>

      <div v-if="p.ctaLabel && href" class="mt-8">
        <a
          v-if="external"
          :href="href"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary btn-lg shadow-lg shadow-black/10"
        >
          {{ p.ctaLabel }}
        </a>
        <NuxtLink v-else :to="href" class="btn btn-primary btn-lg shadow-lg shadow-black/10">
          {{ p.ctaLabel }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
