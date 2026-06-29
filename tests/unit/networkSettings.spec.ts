import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import SettingsNetwork from '../../src/components/settings/SettingsNetwork.vue';
import { i18n } from '../../src/i18n';
import { defaultSettings } from '../../src/tauri/types/config';

describe('network settings', () => {
  it('binds the shared network editor to the settings model', async () => {
    const settings = structuredClone(defaultSettings);
    const wrapper = mount(SettingsNetwork, {
      props: {
        modelValue: settings,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.get('#proxyUrl').attributes('disabled')).toBeDefined();

    await wrapper.get('#enableProxy').setValue(true);
    await nextTick();
    await wrapper.get('#proxyUrl').setValue('socks5://127.0.0.1:1080/');
    await wrapper.get('#impersonate').setValue('any');

    expect(settings.network.enableProxy).toBe(true);
    expect(wrapper.get('#proxyUrl').attributes('disabled')).toBeUndefined();
    expect(settings.network.proxy).toBe('socks5://127.0.0.1:1080/');
    expect(settings.network.impersonate).toBe('any');
  });
});
