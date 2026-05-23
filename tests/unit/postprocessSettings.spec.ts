import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import BaseSelect from '../../src/components/base/BaseSelect.vue';
import SettingsOutput from '../../src/components/settings/SettingsOutput.vue';
import { i18n } from '../../src/i18n';
import { defaultSettings } from '../../src/tauri/types/config';
import {
  AudioPostprocessPreset,
  TranscodePolicy,
  VideoContainer,
  VideoPostprocessMode,
  VideoPostprocessPreset,
} from '../../src/tauri/types/media';

const POSTPROCESS_LABEL = 'Video post-processing:';
const POSTPROCESS_WARNING = i18n.global.t('settings.output.postprocess.hint');
const REENCODE_WARNING = i18n.global.t('settings.output.postprocess.reencodeWarning');
const MP42_HINT = i18n.global.t('settings.output.postprocess.mp42RequiresMp4');
const KEEP_ORIGINAL_STREAMS_CONFLICT = i18n.global.t(
  'settings.output.postprocess.keepOriginalStreamsConflict',
);

describe('post-processing settings', () => {
  it('binds the postprocess select to the model value', async () => {
    const wrapper = mount(BaseSelect, {
      props: {
        label: 'Video post-processing',
        hint: '',
        options: VideoPostprocessPreset,
        localeKey: 'settings.output.postprocess.options',
        modelValue: VideoPostprocessPreset.none,
      },
      global: {
        plugins: [i18n],
      },
    });

    await wrapper.find('select').setValue(VideoPostprocessPreset.fps30);

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(VideoPostprocessPreset.fps30);
  });

  it('shows the reencode warning for fps30 without rendering custom args', async () => {
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

    const postprocessSelect = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === POSTPROCESS_LABEL);

    expect(postprocessSelect).toBeTruthy();
    await postprocessSelect!.find('select').setValue(VideoPostprocessPreset.fps30);
    await nextTick();

    expect(settings.output.video.postprocessPreset).toBe(VideoPostprocessPreset.fps30);
    expect(wrapper.find('#video-postprocess-args').exists()).toBe(false);
    expect(wrapper.text()).toContain(POSTPROCESS_WARNING);
    expect(wrapper.text()).toContain(REENCODE_WARNING);
  });

  it('shows and binds video ffmpeg args only for the custom preset', async () => {
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

    const postprocessSelect = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === POSTPROCESS_LABEL);

    expect(postprocessSelect).toBeTruthy();
    expect(wrapper.find('#video-postprocess-args').exists()).toBe(false);

    await postprocessSelect!.find('select').setValue(VideoPostprocessPreset.custom);
    await nextTick();
    await wrapper.get('#video-postprocess-args').setValue('-movflags +faststart');

    expect(settings.output.video.postprocessPreset).toBe(VideoPostprocessPreset.custom);
    expect(settings.output.video.postprocessArgs).toBe('-movflags +faststart');
    expect(wrapper.text()).toContain(POSTPROCESS_WARNING);
  });

  it('maps the keep original streams checkbox to the output policies', async () => {
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

    await wrapper.get('#keep-original-streams-video').setValue(true);
    expect(settings.output.video.policy).toBe(TranscodePolicy.never);

    await wrapper.get('#keep-original-streams-video').setValue(false);
    expect(settings.output.video.policy).toBe(TranscodePolicy.allowReencode);

    await wrapper.get('#audio').trigger('click');
    await wrapper.get('#keep-original-streams-audio').setValue(true);
    expect(settings.output.audio.policy).toBe(TranscodePolicy.never);

    await wrapper.get('#keep-original-streams-audio').setValue(false);
    expect(settings.output.audio.policy).toBe(TranscodePolicy.allowReencode);
  });

  it('shows the MP4-only alert when mp42 is selected without mp4 output', async () => {
    const settings = structuredClone(defaultSettings);
    settings.output.video.container = VideoContainer.mkv;

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

    const postprocessSelect = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === POSTPROCESS_LABEL);

    expect(postprocessSelect).toBeTruthy();
    await postprocessSelect!.find('select').setValue(VideoPostprocessPreset.mp42);
    await nextTick();

    expect(wrapper.text()).toContain(MP42_HINT);
  });

  it('shows the keep-original-streams conflict for custom re-encode mode immediately', async () => {
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

    const selects = wrapper.findAllComponents(BaseSelect);
    const postprocessSelect = selects.find(component => component.props('label') === POSTPROCESS_LABEL);

    expect(postprocessSelect).toBeTruthy();
    await postprocessSelect!.find('select').setValue(VideoPostprocessPreset.custom);
    await nextTick();
    await wrapper.get('#keep-original-streams-video').setValue(true);
    await nextTick();

    const modeSelect = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === 'Custom post-processing mode:');

    expect(modeSelect).toBeTruthy();
    await modeSelect!.find('select').setValue(VideoPostprocessMode.reencode);
    await nextTick();

    expect(wrapper.text()).toContain(KEEP_ORIGINAL_STREAMS_CONFLICT);
    expect(wrapper.text()).toContain(REENCODE_WARNING);
  });

  it('shows and binds audio ffmpeg args only for the custom preset', async () => {
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

    await wrapper.get('#audio').trigger('click');
    await nextTick();

    const audioPostprocessSelect = wrapper
      .findAllComponents(BaseSelect)
      .find(component => component.props('label') === 'Audio post-processing:');

    expect(audioPostprocessSelect).toBeTruthy();
    expect(wrapper.find('#audio-postprocess-args').exists()).toBe(false);

    await audioPostprocessSelect!.find('select').setValue(AudioPostprocessPreset.custom);
    await nextTick();
    await wrapper.get('#audio-postprocess-args').setValue('-metadata artist=Example');

    expect(settings.output.audio.postprocessPreset).toBe(AudioPostprocessPreset.custom);
    expect(settings.output.audio.postprocessArgs).toBe('-metadata artist=Example');
    expect(wrapper.text()).toContain(POSTPROCESS_WARNING);
  });
});
