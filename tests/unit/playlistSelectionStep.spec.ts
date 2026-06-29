import { mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PlaylistSelectionStep from '../../src/components/media-card/steps/PlaylistSelectionStep.vue';
import PlaylistSelectionModal from '../../src/components/media-card/steps/PlaylistSelectionModal.vue';
import { i18n } from '../../src/i18n';
import type { Group } from '../../src/tauri/types/group';

const expandPlaylistGroup = vi.fn();
const showToast = vi.fn();

vi.mock('../../src/stores/media/media.ts', () => ({
  useMediaStore: () => ({
    expandPlaylistGroup,
  }),
}));

vi.mock('../../src/stores/toast.ts', () => ({
  useToastStore: () => ({
    showToast,
  }),
}));

function createGroup(): Group {
  return {
    id: 'group-1',
    url: 'https://example.com/playlist',
    title: 'Playlist',
    total: 2,
    processed: 0,
    errored: 0,
    isCombined: false,
    audioCodecs: [],
    formats: [],
    filesize: 0,
    entries: [
      { index: 0, videoUrl: 'https://example.com/playlist?v=1' },
      { index: 1, videoUrl: 'https://example.com/playlist?v=2' },
    ],
    items: {
      leader: {
        id: 'leader',
        isLeader: true,
        url: 'https://example.com/playlist',
        audioCodecs: [],
        formats: [],
        filesize: 0,
        entries: [],
      },
    },
  };
}

describe('PlaylistSelectionStep', () => {
  beforeEach(() => {
    expandPlaylistGroup.mockReset();
    showToast.mockReset();
  });

  it('validates incomplete simple ranges', async () => {
    const wrapper = mount(PlaylistSelectionStep, {
      props: { group: createGroup() },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.get('#playlist-selection-start').setValue('1');
    await wrapper.get('#playlist-selection-start').trigger('blur');

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('Download'));
    expect(applyButton?.attributes('disabled')).toBeDefined();
    expect(wrapper.get('#playlist-selection-start').classes()).toContain('input-error');
  });

  it('applies a valid simple range selection', async () => {
    expandPlaylistGroup.mockResolvedValue(undefined);

    const wrapper = mount(PlaylistSelectionStep, {
      props: { group: createGroup() },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.get('#playlist-selection-start').setValue('1');
    await wrapper.get('#playlist-selection-end').setValue('1');

    expect(wrapper.text()).toContain('1 of 2 item selected');

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('Download selected items'));
    expect(applyButton).toBeTruthy();
    await applyButton!.trigger('click');

    expect(expandPlaylistGroup).toHaveBeenCalledWith('group-1', {
      rows: [{ id: 'playlist-selection-range', type: 'range', start: 1, end: 1 }],
    });
  });

  it('shows advanced selections and clears them back to simple mode', async () => {
    const wrapper = mount(PlaylistSelectionStep, {
      props: { group: createGroup() },
      global: {
        plugins: [i18n],
      },
    });

    wrapper.getComponent(PlaylistSelectionModal).vm.$emit('apply', {
      rows: [{ id: 'single', type: 'single', index: 2 }],
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Advanced:');
    expect(wrapper.find('code').text()).toBe('2');

    const resetButton = wrapper.findAll('button').find(button => button.text().includes('Reset'));
    expect(resetButton).toBeTruthy();
    await resetButton!.trigger('click');

    expect(wrapper.find('code').exists()).toBe(false);
    expect(wrapper.find('#playlist-selection-start').exists()).toBe(true);
  });

  it('shows an error toast when applying the selection fails', async () => {
    expandPlaylistGroup.mockRejectedValue(new Error('bad range'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mount(PlaylistSelectionStep, {
      props: { group: createGroup() },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.get('#playlist-selection-start').setValue('1');
    await wrapper.get('#playlist-selection-end').setValue('1');

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('Download selected items'));
    await applyButton!.trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('Error: bad range', { style: 'error' });

    consoleError.mockRestore();
  });
});

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
