<script setup lang="ts">
import type { PageMeta } from '@myapp/shared-types';

defineProps<{ meta: PageMeta }>();
const emit = defineEmits<{ change: [page: number] }>();
</script>

<template>
  <div v-if="meta.totalPages > 1" class="flex flex-wrap items-center justify-between gap-3">
    <span class="text-sm text-slate-500">
      صفحه {{ formatNumber(meta.page) }} از {{ formatNumber(meta.totalPages) }} ·
      {{ formatNumber(meta.total) }} مورد
    </span>
    <div class="flex gap-2">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="meta.page <= 1"
        @click="emit('change', meta.page - 1)"
      >
        قبلی
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="meta.page >= meta.totalPages"
        @click="emit('change', meta.page + 1)"
      >
        بعدی
      </button>
    </div>
  </div>
</template>