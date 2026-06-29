import { mount } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import InputFiltersView from '../../src/views/app/InputFiltersView.vue';
import { i18n } from '../../src/i18n';
import { createDefaultInputFilterSettings } from '../../src/helpers/inputFilters';
import { defaultSettings, type Settings } from '../../src/tauri/types/config';

const patch = vi.fn();
const showToast = vi.fn();
const settingsState = reactive<Settings>(structuredClone(defaultSettings));

vi.mock('../../src/stores/settings.ts', () => ({
  useSettingsStore: () => ({
    settings: settingsState,
    patch,
  }),
}));

vi.mock('../../src/stores/toast.ts', () => ({
  useToastStore: () => ({
    showToast,
  }),
}));

describe('InputFiltersView', () => {
  beforeEach(() => {
    patch.mockReset();
    showToast.mockReset();
    Object.assign(settingsState, structuredClone(defaultSettings));
    settingsState.inputFilters = createDefaultInputFilterSettings();
  });

  it('applies and clears date presets in the draft form', async () => {
    const wrapper = mount(InputFiltersView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    const presetSelect = wrapper.get('#input-filters-date-preset');
    const dateInput = wrapper.get('#input-filters-date');

    expect((dateInput.element as HTMLInputElement).disabled).toBe(true);

    await presetSelect.setValue('last7Days');
    await nextTick();

    expect((dateInput.element as HTMLInputElement).disabled).toBe(false);
    expect((dateInput.element as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const clearButton = wrapper.findAll('button').find(button => button.text().includes('Off'));
    expect(clearButton).toBeTruthy();
    await clearButton!.trigger('click');
    await nextTick();

    expect((dateInput.element as HTMLInputElement).disabled).toBe(true);
    expect((dateInput.element as HTMLInputElement).value).toBe('');
  });

  it('normalizes values before saving and shows a success toast', async () => {
    patch.mockResolvedValue(undefined);

    const wrapper = mount(InputFiltersView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    await wrapper.get('#input-filters-min-size').setValue('50');
    await wrapper.get('#input-filters-match-filters').setValue('  !is_live  ');
    const exactButton = wrapper.findAll('button').find(button => button.text().includes('On date'));
    expect(exactButton).toBeTruthy();
    await exactButton!.trigger('click');
    await nextTick();
    await wrapper.get('#input-filters-date').setValue('2026-06-21');
    await nextTick();
    await wrapper.get('form').trigger('submit');

    expect(patch).toHaveBeenCalledWith({
      inputFilters: {
        minSize: { value: 50, unit: 'MB' },
        maxSize: { value: null, unit: 'MB' },
        dateFilter: { mode: 'exact', value: '2026-06-21' },
        matchFilters: '!is_live',
        breakMatchFilters: null,
      },
    });
    expect(showToast).toHaveBeenCalledWith('Input filters saved!', { style: 'success' });
  });

  it('resets the draft back to defaults', async () => {
    const wrapper = mount(InputFiltersView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    await wrapper.get('#input-filters-min-size').setValue('25');
    await wrapper.get('#input-filters-date-preset').setValue('today');
    await nextTick();

    const resetButton = wrapper.findAll('button').find(button => button.text().includes('Reset'));
    expect(resetButton).toBeTruthy();

    await resetButton!.trigger('click');
    await nextTick();

    expect((wrapper.get('#input-filters-min-size').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('#input-filters-date').element as HTMLInputElement).disabled).toBe(true);
  });

  it('shows an error toast when saving fails', async () => {
    patch.mockRejectedValue(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mount(InputFiltersView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    await wrapper.get('#input-filters-min-size').setValue('10');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('Unable to save input filters. Error: boom', {
      style: 'error',
    });

    consoleError.mockRestore();
  });
});

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
