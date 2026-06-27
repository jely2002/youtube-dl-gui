import { computed, ref, type Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OutputSettings } from '../tauri/types/config.ts';
import {
  AudioPostprocessPreset,
  TranscodePolicy,
  VideoContainer,
  VideoPostprocessMode,
  VideoPostprocessPreset,
} from '../tauri/types/media.ts';

export interface OutputEditorTab {
  id: 'video' | 'audio';
  label: string;
}

export function useOutputSettingsEditor(outputState: Ref<OutputSettings>) {
  const { t } = useI18n();

  const activeTab = ref<'video' | 'audio'>('video');
  const tabs = computed<OutputEditorTab[]>(() => ([
    { id: 'video', label: t('settings.output.tabs.video.label') },
    { id: 'audio', label: t('settings.output.tabs.audio.label') },
  ]));

  const keepOriginalStreamsVideo = computed<boolean>({
    get: () => outputState.value.video.policy === TranscodePolicy.never,
    set: (value) => {
      outputState.value.video.policy = value
        ? TranscodePolicy.never
        : TranscodePolicy.allowReencode;
    },
  });

  const keepOriginalStreamsAudio = computed<boolean>({
    get: () => outputState.value.audio.policy === TranscodePolicy.never,
    set: (value) => {
      outputState.value.audio.policy = value
        ? TranscodePolicy.never
        : TranscodePolicy.allowReencode;
    },
  });

  const isCustomVideoPostprocess = computed(
    () => outputState.value.video.postprocessPreset === VideoPostprocessPreset.custom,
  );
  const showAudioPostprocessArgs = computed(
    () => outputState.value.audio.postprocessPreset === AudioPostprocessPreset.custom,
  );
  const videoRequiresReencode = computed(() => (
    outputState.value.video.postprocessPreset === VideoPostprocessPreset.fps30
    || (
      isCustomVideoPostprocess.value
      && outputState.value.video.customPostprocessMode === VideoPostprocessMode.reencode
    )
  ));
  const showReencodeWarning = computed(() => videoRequiresReencode.value);
  const showKeepOriginalStreamsConflict = computed(
    () => keepOriginalStreamsVideo.value && videoRequiresReencode.value,
  );
  const showMp42ContainerConflict = computed(
    () => (
      outputState.value.video.postprocessPreset === VideoPostprocessPreset.mp42
      && outputState.value.video.container !== VideoContainer.mp4
    ),
  );
  const postprocessHint = computed(() => t('settings.output.postprocess.hint'));

  watch(() => outputState.value.video.postprocessPreset, (preset) => {
    if (preset !== VideoPostprocessPreset.custom) {
      outputState.value.video.postprocessArgs = '';
    }
  });

  watch(() => outputState.value.audio.postprocessPreset, (preset) => {
    if (preset !== AudioPostprocessPreset.custom) {
      outputState.value.audio.postprocessArgs = '';
    }
  });

  return {
    activeTab,
    tabs,
    keepOriginalStreamsVideo,
    keepOriginalStreamsAudio,
    postprocessHint,
    showVideoPostprocessArgs: isCustomVideoPostprocess,
    showVideoPostprocessMode: isCustomVideoPostprocess,
    showAudioPostprocessArgs,
    showReencodeWarning,
    showKeepOriginalStreamsConflict,
    showMp42ContainerConflict,
  };
}
