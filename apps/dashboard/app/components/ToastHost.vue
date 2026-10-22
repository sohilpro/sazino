<script setup lang="ts">
const { toasts, dismiss } = useToast();

const styles = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
} as const;
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 start-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    aria-live="polite"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="pointer-events-auto flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg"
      :class="styles[t.type]"
      role="status"
    >
      <span>{{ t.message }}</span>
      <button
        type="button"
        class="opacity-70 hover:opacity-100"
        aria-label="بستن"
        @click="dismiss(t.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>