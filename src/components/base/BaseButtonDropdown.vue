<template>
  <div class="join divide-x-2">
    <base-button
        class="join-item"
        :class="btnClasses"
        :tooltip="mainTooltip"
        :disabled="disabled"
        @click="onMainClick"
    >
      <slot name="main" />
    </base-button>

    <div class="dropdown" :class="dropdownClasses">
      <button
          class="btn btn-subtle join-item px-1"
          :class="btnClasses"
          type="button"
          tabindex="0"
          :disabled="disabled || caretDisabled ? true : undefined"
          aria-haspopup="menu"
          :aria-label="caretAriaLabel"
      >
        <slot name="caret">
          <chevron-down-icon class="w-5 h-5" />
        </slot>
      </button>

      <ul
          class="dropdown-content menu bg-base-100 rounded-box shadow z-1 border border-base-300"
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
    caretAriaLabel: '',
    closeOnItemClick: true,
  },
);

const emit = defineEmits<{
  mainClick: [];
}>();

const dropdownClasses = computed(() => [
  props.placement === 'top' ? 'dropdown-top' : 'dropdown-bottom',
  props.align === 'end' ? 'dropdown-end' : 'dropdown-start',
]);

const btnClasses = computed(() => [props.btnClass]);

const menuClasses = computed(() => [
  props.menuSize === 'sm' ? 'menu-sm' : 'menu-md',
  props.menuWidthClass,
]);

function onMainClick() {
  emit('mainClick');
}

function blurFromEvent(event: Event) {
  const target = event.target as HTMLElement | null;

  const clickable = target?.closest('button, a, [role="menuitem"]') as HTMLElement | null;
  (clickable ?? target)?.blur();

  const dropdown = target?.closest('.dropdown') as HTMLElement | null;
  const toggle = dropdown?.querySelector('button[tabindex="0"]') as HTMLElement | null;
  toggle?.blur();
}
</script>
