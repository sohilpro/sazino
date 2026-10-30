<script setup lang="ts">
import type { RichTextBlock } from '@myapp/shared-types';

const props = defineProps<{ block: RichTextBlock }>();

const nodes = computed(() => parseRichText(props.block.props.content));
</script>

<template>
  <section
    class="mx-auto max-w-3xl space-y-4 leading-8 text-slate-700"
    :class="block.props.align === 'center' ? 'text-center' : 'text-start'"
  >
    <template v-for="(node, i) in nodes" :key="i">
      <h2 v-if="node.type === 'heading' && node.level === 2" class="text-2xl font-extrabold text-slate-900">
        {{ node.text }}
      </h2>
      <h3 v-else-if="node.type === 'heading'" class="text-xl font-bold text-slate-900">{{ node.text }}</h3>
      <p v-else-if="node.type === 'paragraph'" class="whitespace-pre-line">{{ node.text }}</p>
      <ul v-else class="list-disc space-y-1 ps-6 text-start">
        <li v-for="(item, j) in node.items" :key="j">{{ item }}</li>
      </ul>
    </template>
  </section>
</template>