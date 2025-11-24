import { defineStore } from 'pinia';
import { ref } from 'vue';

let idCounter = 0;

export type ToastStyle = 'success' | 'info' | 'error' | 'warning' | 'subtle';

export type Toast = {
  id: number;
  message: string;
  style: ToastStyle;
  duration: number;
};

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  const showToast = (message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}) => {
    const id = ++idCounter;
    const toast: Toast = {
      id,
      message,
      style: options.style ?? 'info',
      duration: options.duration ?? 3000,
    };

    toasts.value.push(toast);

    if (toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }
  };

  const removeToast = (id: number) => {
    toasts.value.splice(toasts.value.findIndex(t => t.id === id), 1);
  };

  return {
    toasts,
    showToast,
    removeToast,
  };
});
