<script setup lang="ts">
const props = defineProps<{ current: 1 | 2 | 3 }>();

const STEPS = ['سبد خرید', 'تکمیل خرید', 'پرداخت'] as const;
const state = (n: number) => (n < props.current ? 'done' : n === props.current ? 'current' : 'todo');
</script>

<template>
  <ol class="flex items-center gap-2 text-sm" aria-label="مراحل خرید">
    <li v-for="(label, i) in STEPS" :key="label" class="flex items-center gap-2" :class="i < STEPS.length - 1 && 'flex-1'">
      <span
        class="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition"
        :class="{
          'bg-emerald-500 text-white': state(i + 1) === 'done',
          'bg-brand-600 text-on-brand': state(i + 1) === 'current',
          'bg-slate-200 text-slate-500': state(i + 1) === 'todo',
        }"
        :aria-current="state(i + 1) === 'current' ? 'step' : undefined"
      >
        <StoreIcon v-if="state(i + 1) === 'done'" name="check" :size="14" />
        <template v-else>{{ formatNumber(i + 1) }}</template>
      </span>
      <span
        class="whitespace-nowrap"
        :class="[state(i + 1) === 'current' ? 'font-bold' : 'text-slate-500', state(i + 1) !== 'current' && 'max-sm:hidden']"
      >
        {{ label }}
      </span>
      <span v-if="i < STEPS.length - 1" class="h-px flex-1 bg-slate-200" />
    </li>
  </ol>
</template>
