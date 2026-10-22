export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);
  const seq = useState<number>('toast-seq', () => 0);

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function push(type: Toast['type'], message: string, ms = 4000) {
    const id = ++seq.value;
    toasts.value = [...toasts.value, { id, type, message }];
    setTimeout(() => dismiss(id), ms);
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 7000),
    info: (message: string) => push('info', message),
  };
}