import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import BaseSelect from '../../src/components/base/BaseSelect.vue';
import SettingsOutput from '../../src/components/settings/SettingsOutput.vue';
import TheOutputPreferences from '../../src/components/media-view/TheOutputPreferences.vue';
import { i18n } from '../../src/i18n';
import { useMediaGroupStore } from '../../src/stores/media/group';
import { useMediaOptionsStore } from '../../src/stores/media/options';
import { useSettingsStore } from '../../src/stores/settings';
import { defaultSettings } from '../../src/tauri/types/config';
import { ThumbnailFormat } from '../../src/tauri/types/media';
import type { MediaItem } from '../../src/tauri/types/media';

const THUMBNAIL_FORMAT_LABEL = i18n.global.t('settings.output.thumbnailFormat.label');

function createGroupItem(id: string): MediaItem {
  return {
    id,
    url: `https://example.com/${id}`,
    audioCodecs: [],
    formats: [],
    filesize: 0,
    isLeader: true,
  };
}

describe('thumbnail format setting', () => {
  it('defaults to jpg', () => {
    expect(defaultSettings.output.thumbnailFormat).toBe(ThumbnailFormat.jpg);
  });

  it('emits the selected format', async () => {
    const wrapper = mount(BaseSelect, {
      props: {
        label: THUMBNAIL_FORMAT_LABEL,
        hint: '',
        options: ThumbnailFormat,
        localeKey: 'settings.output.thumbnailFormat.options',
        modelValue: ThumbnailFormat.jpg,
      },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.find('select').setValue(ThumbnailFormat.png);

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(ThumbnailFormat.png);
  });

  it('renders all three options in the output settings', () => {
    const settings = structuredClone(defaultSettings);
    const wrapper = mount(SettingsOutput, {
      props: {
        modelValue: settings,
      },
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    const select = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === THUMBNAIL_FORMAT_LABEL);

    expect(select).toBeTruthy();
    expect(select!.findAll('option').map(option => option.element.value)).toEqual([
      ThumbnailFormat.original,
      ThumbnailFormat.jpg,
      ThumbnailFormat.png,
    ]);
  });

  it('stores a per-group thumbnail format override and clears it when reset', async () => {
    const groupId = 'group-thumbnail-format';
    const settingsStore = useSettingsStore();
    settingsStore.settings.output = structuredClone(defaultSettings.output);

    const groupStore = useMediaGroupStore();
    groupStore.createGroup({
      id: groupId,
      url: 'https://example.com',
      total: 1,
      processed: 1,
      errored: 0,
      isCombined: false,
      audioCodecs: [],
      formats: [],
      filesize: 0,
      items: {
        leader: createGroupItem('leader'),
      },
    });

    const optionsStore = useMediaOptionsStore();
    const wrapper = mount(TheOutputPreferences, {
      props: {
        groupId,
      },
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: true,
        },
      },
    });

    await nextTick();
    const select = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === THUMBNAIL_FORMAT_LABEL);

    expect(select).toBeTruthy();
    await select!.find('select').setValue(ThumbnailFormat.original);
    await nextTick();

    expect(optionsStore.getOverrides(groupId)?.output?.thumbnailFormat).toBe(
      ThumbnailFormat.original,
    );

    await select!.find('select').setValue(ThumbnailFormat.jpg);
    await nextTick();

    expect(optionsStore.getOverrides(groupId)?.output).toBeUndefined();
  });
});
