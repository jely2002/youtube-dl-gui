<template>
  <div class="toast toast-start toast-bottom bottom-32 fixed z-50">
    <TransitionGroup name="toast-fade" tag="div">
      <div
          v-for="toast in toasts"
          :key="toast.id"
          class="alert cursor-pointer mb-2"
          :class="styleClass(toast.style)"
          @click="removeToast(toast.id)"
      >
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">

import { ToastStyle, useToastStore } from '../stores/toast';

const { toasts, removeToast } = useToastStore();

const styleClass = (style: ToastStyle) => {
  return {
    'alert-success': style === 'success',
    'alert-info': style === 'info',
    'alert-error': style === 'error',
    'alert-warning': style === 'warning',
    '': style === 'subtle',
  };
};
</script>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
