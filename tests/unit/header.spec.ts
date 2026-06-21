import { mount, RouterLinkStub } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import TheHeader from '../../src/components/TheHeader.vue';
import { i18n } from '../../src/i18n';

const dispatchMediaInfoFetch = vi.fn();
const addAndDownload = vi.fn();
const addUrlBatch = vi.fn();
const addUrlBatchAndDownload = vi.fn();

vi.mock('../../src/stores/media/media', () => ({
  useMediaStore: () => ({
    dispatchMediaInfoFetch,
    addAndDownload,
    addUrlBatch,
    addUrlBatchAndDownload,
  }),
}));

vi.mock('../../src/stores/toast', () => ({
  useToastStore: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../src/stores/recordMode', () => ({
  useRecordModeStore: () => ({
    isActive: false,
    toggle: vi.fn(),
    hasSeen: vi.fn(() => false),
    markSeen: vi.fn(),
  }),
}));

vi.mock('../../src/stores/settings', () => ({
  useSettingsStore: () => ({
    settings: {
      input: {
        autoFillClipboard: false,
      },
    },
  }),
}));

vi.mock('../../src/composables/useClipboard', () => ({
  useClipboard: () => ({
    content: ref(''),
    poll: vi.fn(),
  }),
}));

function createBlankView() {
  return defineComponent({
    template: '<div />',
  });
}

describe('TheHeader', () => {
  it('navigates the settings button to the downloads tab route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: createBlankView(),
        },
        {
          path: '/settings',
          name: 'settings.downloads',
          component: createBlankView(),
        },
      ],
    });

    await router.push('/');
    await router.isReady();

    const wrapper = mount(TheHeader, {
      global: {
        plugins: [router, i18n],
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'settings.downloads' });
  });
});
