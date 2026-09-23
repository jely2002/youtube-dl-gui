import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import TheNetworkPreferences from '../../src/components/media-view/TheNetworkPreferences.vue';
import { i18n } from '../../src/i18n';
import { useMediaOptionsStore } from '../../src/stores/media/options';
import { useSettingsStore } from '../../src/stores/settings';
import { defaultSettings } from '../../src/tauri/types/config';

describe('network overrides', () => {
  it('stores per-group network overrides and clears them when reset', async () => {
    const groupId = 'group-network';
    const settingsStore = useSettingsStore();
    settingsStore.settings.network = structuredClone(defaultSettings.network);

    const optionsStore = useMediaOptionsStore();
    const wrapper = mount(TheNetworkPreferences, {
      props: {
        groupId,
      },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.get('#override-enable-proxy').setValue(true);
    await nextTick();
    await wrapper.get('#override-proxy').setValue('  socks5://127.0.0.1:1080/  ');
    await wrapper.get('#override-impersonate').setValue('any');
    await nextTick();

    expect(optionsStore.getOverrides(groupId)?.network).toEqual({
      enableProxy: true,
      proxy: 'socks5://127.0.0.1:1080/',
      noCheckCertificates: false,
      impersonate: 'any',
    });

    await wrapper.get('#override-proxy').setValue('');
    await wrapper.get('#override-enable-proxy').setValue(false);
    await wrapper.get('#override-impersonate').setValue('none');
    await nextTick();

    expect(optionsStore.getOverrides(groupId)).toBeUndefined();
  });

  it('stores the certificate check override and only enables it with a proxy', async () => {
    const groupId = 'group-certificates';
    const settingsStore = useSettingsStore();
    settingsStore.settings.network = structuredClone(defaultSettings.network);

    const optionsStore = useMediaOptionsStore();
    const wrapper = mount(TheNetworkPreferences, {
      props: {
        groupId,
      },
      global: {
        plugins: [i18n],
      },
    });

    const certificateToggle = wrapper.get('#override-no-check-certificates');
    expect(certificateToggle.attributes('disabled')).toBeDefined();

    await wrapper.get('#override-enable-proxy').setValue(true);
    await wrapper.get('#override-proxy').setValue('https://proxy.example.com:3128');
    await nextTick();
    expect(certificateToggle.attributes('disabled')).toBeUndefined();

    await certificateToggle.setValue(true);
    await nextTick();

    expect(optionsStore.getOverrides(groupId)?.network).toEqual({
      enableProxy: true,
      proxy: 'https://proxy.example.com:3128',
      noCheckCertificates: true,
    });
  });

  it('stores custom header overrides and trims empty lines', async () => {
    const groupId = 'group-headers';
    const optionsStore = useMediaOptionsStore();
    const wrapper = mount(TheNetworkPreferences, {
      props: {
        groupId,
      },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.get('#override-headers').setValue('X-Test: one\n\n Authorization: Bearer token ');
    await nextTick();

    expect(optionsStore.getOverrides(groupId)?.auth).toEqual({
      headers: ['X-Test: one', 'Authorization: Bearer token'],
    });

    await wrapper.get('#override-headers').setValue('\n\n');
    await nextTick();

    expect(optionsStore.getOverrides(groupId)).toBeUndefined();
  });
});
