<template>
  <div class="join relative z-0 divide-x-2 focus-within:z-30">
    <base-button
        class="join-item !rounded-r-none"
        :class="mainButtonClasses"
        :tooltip="mainTooltip"
        :disabled="disabled || mainDisabled ? true : undefined"
        :type="mainType ?? 'button'"
        :loading="mainLoading"
        @click="onMainClick"
    >
      <slot name="main" />
    </base-button>

    <div class="dropdown relative" :class="dropdownClasses">
      <button
          class="btn btn-subtle join-item px-1 !rounded-l-none"
          :class="caretButtonClasses"
          type="button"
          tabindex="0"
          :disabled="disabled || caretDisabled ? true : undefined"
          aria-haspopup="menu"
          :aria-label="caretAriaLabel"
      >
        <slot name="caret">
          <chevron-down-icon class="w-4 h-4" />
        </slot>
      </button>

      <ul
          class="dropdown-content menu w-fit bg-base-100 rounded-box shadow z-50 border border-base-300"
          :class="menuClasses"
          tabindex="0"
          role="menu"
          @click="closeOnItemClick ? blurFromEvent($event) : undefined"
      >
        <slot />
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/24/solid';
import { computed } from 'vue';
import BaseButton from './BaseButton.vue';

type Placement = 'top' | 'bottom';
type Align = 'start' | 'end';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    caretDisabled?: boolean;
    btnClass?: string;
    placement?: Placement;
    align?: Align;
    menuSize?: 'sm' | 'md';
    menuWidthClass?: string;
    mainTooltip?: string;
    mainType?: string;
    mainLoading?: boolean;
    mainDisabled?: boolean;
    flushLeft?: boolean;
    caretAriaLabel?: string;
    closeOnItemClick?: boolean;
  }>(),
  {
    disabled: false,
    caretDisabled: false,
    btnClass: '',
    placement: 'top',
    align: 'end',
    menuSize: 'sm',
    menuWidthClass: 'w-56',
    mainTooltip: '',
    mainLoading: false,
    mainDisabled: false,
    flushLeft: false,
    caretAriaLabel: '',
    closeOnItemClick: true,
  },
);

const emit = defineEmits<{
  mainClick: [event: MouseEvent];
}>();

const dropdownClasses = computed(() => [
  props.placement === 'top' ? 'dropdown-top' : 'dropdown-bottom',
  props.align === 'end' ? 'dropdown-end' : 'dropdown-start',
]);

const mainButtonClasses = computed(() => [
  props.btnClass,
  props.flushLeft ? '!rounded-l-none !border-l-0' : '',
]);

const caretButtonClasses = computed(() => {
  if (props.disabled || props.caretDisabled) {
    return [props.btnClass];
  }

  if (props.mainDisabled) {
    return ['btn-soft'];
  }

  return [props.btnClass];
});

const menuClasses = computed(() => [
  props.menuSize === 'sm' ? 'menu-sm' : 'menu-md',
  props.menuWidthClass,
]);

function onMainClick(event: MouseEvent) {
  emit('mainClick', event);
}

function blurFromEvent(event: Event) {
  const target = event.target as HTMLElement | null;
  const clickable = target?.closest('button, a, [role="menuitem"]') as HTMLElement | null;
  (clickable ?? target)?.blur();

  const dropdown = target?.closest('.dropdown') as HTMLElement | null;
  const menu = dropdown?.querySelector('.dropdown-content[tabindex="0"]') as HTMLElement | null;
  const toggle = dropdown?.querySelector('button[tabindex="0"]') as HTMLElement | null;
  menu?.blur();
  toggle?.blur();

  requestAnimationFrame(() => {
    menu?.blur();
    toggle?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}
</script>
