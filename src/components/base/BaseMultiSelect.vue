<template>
  <div class="w-full">
    <div :class="{ 'opacity-50 pointer-events-none': disabled }">
      <label v-if="label" class="font-semibold">
        {{ label }}
      </label>

      <div
          ref="rootElementRef"
          class="w-full relative mt-2"
          @pointerdown.self="focusTextInput"
      >
        <div
            class="input input-bordered flex flex-wrap gap-1 items-center w-full"
            @pointerdown.self.prevent="focusTextInput"
        >
          <span
              v-for="selectedValue in internalSelectedValues"
              :key="selectedValue"
              class="badge badge-neutral gap-1 whitespace-nowrap"
              role="group"
              :aria-label="`Selected ${getLabelForValue(selectedValue)}`"
              @click="focusTextInput()"
          >
            <slot
                name="selected"
                v-bind="selectedSlotProps(selectedValue)"
            >
              <span>{{ getLabelForValue(selectedValue) }}</span>
              <button
                  class="btn btn-ghost btn-xs p-0 ml-1"
                  type="button"
                  @click.stop="removeSelectedValue(selectedValue)"
                  :aria-label="`Remove ${getLabelForValue(selectedValue)}`"
              >
                <XMarkIcon class="w-4 h-4" aria-hidden="true" />
              </button>
            </slot>
          </span>

          <input
              ref="textInputRef"
              :id="inputId"
              :placeholder="internalSelectedValues.length > 0 ? undefined : placeholder"
              class="flex-1 min-w-[8ch] outline-none bg-transparent"
              v-model="filterQuery"
              @focus="onInputFocus"
              @blur="emit('blur')"
              :disabled="disabled"
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="isOpen ? 'true' : 'false'"
              :aria-controls="listboxId"
              :aria-activedescendant="activeDescendantId"
              @keydown="handleComboboxKeydown"
          />

          <button
              v-if="internalSelectedValues.length"
              class="btn btn-ghost btn-xs"
              type="button"
              @click="clearAllSelections"
              aria-label="Clear selections"
          >
            <XMarkIcon class="w-4 h-4" aria-hidden="true" />
          </button>

          <button
              class="btn btn-ghost btn-xs"
              type="button"
              @pointerdown.prevent.stop="toggleOpen"
              :aria-label="isOpen ? 'Close options' : 'Open options'"
              :aria-expanded="isOpen ? 'true' : 'false'"
              :aria-controls="listboxId"
          >
            <ChevronDownIcon class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div v-show="isOpen" class="absolute left-0 right-0 top-14 z-50">
          <ul
              :id="listboxId"
              class="flex flex-col bg-base-100 border border-base-200 shadow-xl w-full rounded-box overflow-auto"
              :style="{ maxHeight: computedMaxHeight }"
              role="listbox"
              aria-multiselectable="true"
          >
            <li v-if="filteredOptions.length === 0" class="disabled">
              <div role="option" aria-disabled="true">
                <slot name="empty">
                  {{ emptyText }}
                </slot>
              </div>
            </li>

            <li
                v-for="(option, optionIndex) in filteredOptions"
                :key="option.value"
            >
              <div
                  class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                  :id="getOptionId(optionIndex)"
                  role="option"
                  :aria-selected="isValueSelected(option.value) ? 'true' : 'false'"
                  :aria-disabled="option.disabled ? 'true' : 'false'"
                  :class="{
                  'bg-base-200': optionIndex === activeOptionIndex,
                  'opacity-50 pointer-events-none': option.disabled,
                }"
                  @mouseenter="activeOptionIndex = optionIndex"
                  @mousedown.prevent="toggleValue(option.value)"
              >
                <slot
                    name="option"
                    v-bind="optionSlotProps(option, optionIndex)"
                >
                  <span class="truncate">{{ option.label }}</span>
                  <CheckIcon
                      v-if="isValueSelected(option.value)"
                      class="w-4 h-4"
                      aria-hidden="true"
                  />
                </slot>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="error" class="text-error text-sm mt-1">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { XMarkIcon, ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/solid';

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

const props = defineProps<{
  options: MultiSelectOption[];
  label?: string;
  placeholder?: string;
  emptyText?: string;
  error?: string;
  maxHeight?: string;
  max?: number;
  disabled?: boolean;
}>();

const model = defineModel<string[]>({ required: true });

const emit = defineEmits<{
  (e: 'change', value: string[]): void;
  (e: 'blur'): void;
  (e: 'focus'): void;
}>();

const isOpen = ref<boolean>(false);
const filterQuery = ref<string>('');
const textInputRef = ref<HTMLInputElement | null>(null);
const rootElementRef = ref<HTMLElement | null>(null);
const activeOptionIndex = ref<number>(0);
const suppressNextFocusOpen = ref<boolean>(false);

const listboxId: string = `ms-listbox-${Math.random().toString(36).slice(2)}`;
const inputId: string = `ms-input-${Math.random().toString(36).slice(2)}`;
const activeDescendantId = computed<string>(() => getOptionId(activeOptionIndex.value));

const emptyText = computed<string>(() => props.emptyText ?? 'No matches');
const internalSelectedValues = computed<string[]>({
  get: () => model.value,
  set: (next) => { model.value = [...next]; },
});

function getOptionId(index: number): string {
  return `${listboxId}-opt-${index}`;
}

const computedMaxHeight = computed<string>(() => props.maxHeight ?? '16rem');

const filteredOptions = computed<MultiSelectOption[]>(() => {
  const normalizedQuery: string = filterQuery.value.trim().toLowerCase();
  return props.options.filter((option: MultiSelectOption) =>
    !normalizedQuery
    || option.label.toLowerCase().includes(normalizedQuery)
    || option.value.toLowerCase().includes(normalizedQuery),
  );
});

function isValueSelected(value: string): boolean {
  return internalSelectedValues.value.includes(value);
}

function getOption(value: string): MultiSelectOption | undefined {
  return props.options.find((o: MultiSelectOption) => o.value === value);
}

function getLabelForValue(value: string): string {
  return getOption(value)?.label ?? value;
}

function focusTextInput(): void {
  void nextTick(() => textInputRef.value?.focus());
}

function toggleValue(value: string) {
  const option = getOption(value);
  if (props.disabled || option?.disabled) return;

  const has = internalSelectedValues.value.includes(value);
  if (has) {
    internalSelectedValues.value = internalSelectedValues.value.filter(v => v !== value);
  } else {
    if (!props.max || internalSelectedValues.value.length < props.max) {
      internalSelectedValues.value = [...internalSelectedValues.value, value];
    }
  }
  emit('change', internalSelectedValues.value);
}

function removeSelectedValue(value: string) {
  internalSelectedValues.value = internalSelectedValues.value.filter(v => v !== value);
  emit('change', internalSelectedValues.value);
}

function clearAllSelections() {
  internalSelectedValues.value = [];
  emit('change', internalSelectedValues.value);
}

function moveActive(delta: 1 | -1): void {
  if (!isOpen.value) isOpen.value = true;
  const total: number = filteredOptions.value.length;
  if (total === 0) return;
  activeOptionIndex.value = (activeOptionIndex.value + delta + total) % total;
}

function moveToEdge(which: 'start' | 'end'): void {
  if (!isOpen.value) isOpen.value = true;
  const total: number = filteredOptions.value.length;
  if (total === 0) return;
  activeOptionIndex.value = which === 'start' ? 0 : total - 1;
}

function selectActiveOption(): void {
  const option: MultiSelectOption | undefined = filteredOptions.value[activeOptionIndex.value];
  if (option) toggleValue(option.value);
}

function onBackspace(event: KeyboardEvent) {
  if (filterQuery.value.length === 0 && internalSelectedValues.value.length > 0) {
    event.preventDefault();
    internalSelectedValues.value = internalSelectedValues.value.slice(0, -1);
    emit('change', internalSelectedValues.value);
  }
}

function onInputFocus(): void {
  if (suppressNextFocusOpen.value) {
    suppressNextFocusOpen.value = false;
    return;
  }
  isOpen.value = true;
  emit('focus');
}

function handleComboboxKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveActive(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveActive(-1);
      break;
    case 'Enter':
      event.preventDefault();
      selectActiveOption();
      break;
    case ' ':
      event.preventDefault();
      selectActiveOption();
      break;
    case 'Tab':
      isOpen.value = false;
      break;
    case 'Escape':
      event.preventDefault();
      isOpen.value = false;
      break;
    case 'Home':
      event.preventDefault();
      moveToEdge('start');
      break;
    case 'End':
      event.preventDefault();
      moveToEdge('end');
      break;
    case 'Backspace':
      onBackspace(event);
      break;
    default:
      break;
  }
}

function toggleOpen(): void {
  if (isOpen.value) {
    suppressNextFocusOpen.value = true;
    textInputRef.value?.blur();
    isOpen.value = false;
  } else {
    isOpen.value = true;
    focusTextInput();
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (!rootElementRef.value) return;
  if (!rootElementRef.value.contains(event.target as Node)) {
    if (isOpen.value) isOpen.value = false;
  }
}

function onRootKeydownCapture(event: KeyboardEvent): void {
  if (event.key !== 'Backspace') return;
  const target = event.target as HTMLElement | null;
  const isEditable
    = !!target
      && (target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable);

  if (!isEditable) {
    event.preventDefault();
    focusTextInput();
    if (filterQuery.value.length === 0 && internalSelectedValues.value.length > 0) {
      internalSelectedValues.value = internalSelectedValues.value.slice(0, -1);
      emit('change', internalSelectedValues.value);
    }
  }
}

function handleFocusOut(event: FocusEvent): void {
  const next = (event.relatedTarget ?? document.activeElement) as Node | null;
  if (!next || !rootElementRef.value) return;
  if (!rootElementRef.value.contains(next)) {
    isOpen.value = false;
  }
}

function optionSlotProps(option: MultiSelectOption, index: number) {
  return {
    option,
    index,
    selected: isValueSelected(option.value),
    active: index === activeOptionIndex.value,
    disabled: !!option.disabled,
    toggle: () => toggleValue(option.value),
  };
}

function selectedSlotProps(value: string) {
  const option = getOption(value);
  return {
    value,
    option,
    label: option?.label ?? value,
    remove: () => removeSelectedValue(value),
  };
}

onMounted((): void => {
  document.addEventListener('mousedown', onDocumentClick);
  rootElementRef.value?.addEventListener('keydown', onRootKeydownCapture, true);
  rootElementRef.value?.addEventListener('focusout', handleFocusOut, true);
});
onUnmounted((): void => {
  document.removeEventListener('mousedown', onDocumentClick);
  rootElementRef.value?.removeEventListener('keydown', onRootKeydownCapture, true);
  rootElementRef.value?.removeEventListener('focusout', handleFocusOut, true);
});
</script>
