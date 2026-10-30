<script setup lang="ts">
import type { PageBlock } from '@myapp/shared-types';

defineProps<{ blocks: PageBlock[] }>();
</script>

<template>
  <!-- نگاشت صریح نوع ← کامپوننت؛ بلاک با نوع ناشناخته (نسخه‌ی جدیدتر داده) ساده نادیده گرفته می‌شود -->
  <div class="space-y-10">
    <template v-for="(block, i) in blocks" :key="block.id">
      <BlockHero v-if="block.type === 'hero'" :block="block" :primary="i === 0" />
      <BlockProductGrid v-else-if="block.type === 'product-grid'" :block="block" />
      <BlockRichText v-else-if="block.type === 'rich-text'" :block="block" />
    </template>
  </div>
</template>