import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import SettingsDependencies from '../../src/components/settings/SettingsDependencies.vue';
import { defaultSettings } from '../../src/tauri/types/config';
import { i18n } from '../../src/i18n';
import { useBinariesStore } from '../../src/stores/binaries';
import { useSettingsStore } from '../../src/stores/settings';
import type { DependencyReport } from '../../src/tauri/types/binaries';
import ToolCard from '../../src/components/tool-card/ToolCard.vue';
import InstallView from '../../src/views/full/InstallView.vue';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
const invokeMock = vi.mocked(invoke);
const openMock = vi.mocked(open);

function report(): DependencyReport {
  return {
    tool: 'deno', status: 'compatible', diagnostics: [],
    active: { tool: 'deno', path: 'C:\\Tools ü\\deno.exe', version: '2.5.0', source: 'system', status: 'compatible', compatibility: 'validated' },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  setActivePinia(createPinia());
});

describe('dependency settings', () => {
  it('shows validated source, version and path, and supports selecting then clearing a manual path', async () => {
    invokeMock.mockResolvedValue([report()]);
    const settings = structuredClone(defaultSettings);
    const wrapper = mount(SettingsDependencies, { props: { modelValue: settings }, global: { plugins: [i18n] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Validated and usable');
    expect(wrapper.text()).toContain('2.5.0');
    expect(wrapper.text()).toContain('System');
    expect(wrapper.text()).toContain('C:\\Tools ü\\deno.exe');
    openMock.mockResolvedValue('C:\\Custom tools\\deno.exe');
    const row = wrapper.get('label[for="dependency-deno"]').element.parentElement!;
    const buttons = row.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();
    await flushPromises();
    expect(settings.dependencies.paths.deno).toBe('C:\\Custom tools\\deno.exe');
    (buttons[1] as HTMLButtonElement).click();
    await flushPromises();
    expect(settings.dependencies.paths.deno).toBe('');
  });

  it('shows invalid configured paths without claiming they are usable', async () => {
    invokeMock.mockResolvedValue([{ tool: 'deno', active: null, status: 'configuredInvalid', diagnostics: [{ path: 'bad', status: 'unableToExecute', reason: 'validation timed out' }] }]);
    const wrapper = mount(SettingsDependencies, { props: { modelValue: structuredClone(defaultSettings) }, global: { plugins: [i18n] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Configured path invalid');
    expect(wrapper.text()).toContain('validation timed out');
    expect(wrapper.text()).not.toContain('Validated and usable');
  });

  it('disables manual selection in bundled distributions', async () => {
    const bundled = report();
    bundled.active!.source = 'bundled';
    invokeMock.mockResolvedValue([bundled]);
    const wrapper = mount(SettingsDependencies, { props: { modelValue: structuredClone(defaultSettings) }, global: { plugins: [i18n] } });
    await flushPromises();
    expect(wrapper.get('#dependency-deno').attributes('disabled')).toBeDefined();
  });
});

describe('dependency startup', () => {
  it('shows tools discovered before installation with their paths and keeps them visible after installation', async () => {
    invokeMock.mockImplementation(async command => command === 'binaries_check'
      ? { tools: ['yt-dlp'], dependencies: [report()] }
      : undefined);
    const store = useBinariesStore();
    await store.check();
    const wrapper = mount(InstallView, { global: { plugins: [i18n], stubs: { BaseButton: true, BaseSubNav: { template: '<div><slot name="title"/><slot/></div>' } } } });
    await flushPromises();
    const found = wrapper.findAllComponents(ToolCard).find(card => card.props('name') === 'deno')!;
    expect(found.props('tool').percent).toBe(100);
    expect(found.get('.badge').text()).toBe('2.5.0');
    expect(found.find('.stroke-success').exists()).toBe(true);
    expect(found.text()).not.toContain('0 B / 0 B');
    expect(wrapper.text()).toContain('C:\\Tools ü\\deno.exe');
    expect(wrapper.text()).toContain('Found on system');
    expect(wrapper.text()).toContain('2.5.0');
    wrapper.unmount();
  });
  it('resolves missing tools even with automatic managed updates disabled', async () => {
    const settings = useSettingsStore();
    const previous = settings.settings.update.updateBinaries;
    settings.settings.update.updateBinaries = false;
    invokeMock.mockResolvedValue({ tools: ['ffprobe'], dependencies: [] });
    expect(await useBinariesStore().check()).toEqual(['ffprobe']);
    expect(invokeMock).toHaveBeenCalledWith('binaries_check');
    settings.settings.update.updateBinaries = previous;
  });

  it('does not request downloads for a fully resolved system tool set', async () => {
    invokeMock.mockResolvedValue({ tools: [], dependencies: [report()] });
    const store = useBinariesStore();
    expect(await store.check()).toEqual([]);
    expect(store.tools).toEqual({});
  });

  it('accepts progress for an additional tool needed to repair an incompatible pair', () => {
    const store = useBinariesStore();
    store.processBinaryDownloadStart({ tool: 'ffmpeg', version: '8.0.0' });
    store.processBinaryDownloadProgress({ tool: 'ffmpeg', total: 100, received: 20 });
    expect(store.tools.ffmpeg.percent).toBe(20);
  });
});
