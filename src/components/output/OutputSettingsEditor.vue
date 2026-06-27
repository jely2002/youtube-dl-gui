<template>
  <div class="flex flex-col">
    <base-tabbed-pane
        v-model="activeTab"
        :tabs="tabs"
        :id-prefix="tabIdPrefix"
    >
      <template #video>
        <h2 class="sr-only">
          {{ t('settings.output.tabs.video.screenreader') }}
        </h2>

        <base-select
            :label="t('settings.output.tabs.video.container.label')"
            :hint="t('settings.output.tabs.video.container.hint')"
            :options="VideoContainer"
            :locale-key="'settings.output.tabs.video.container.options'"
            v-model="outputState.video.container"
            class="mb-4"
        />

        <div class="mb-4 flex flex-col gap-1">
          <label class="font-semibold" :for="fieldId('keep-original-streams-video')">
            {{ t('settings.output.keepOriginalStreams.label') }}
          </label>
          <input
              :id="fieldId('keep-original-streams-video')"
              type="checkbox"
              v-model="keepOriginalStreamsVideo"
              class="toggle toggle-primary my-1"
          />
          <p class="label">
            {{ t('settings.output.keepOriginalStreams.hint') }}
          </p>
        </div>

        <base-select
            :label="t('settings.output.postprocess.label')"
            :hint="postprocessHint"
            :options="VideoPostprocessPreset"
            :locale-key="'settings.output.postprocess.options'"
            v-model="outputState.video.postprocessPreset"
        />

        <base-select
            v-if="showVideoPostprocessMode"
            :label="t('settings.output.postprocessMode.label')"
            :hint="t('settings.output.postprocessMode.hint')"
            :options="VideoPostprocessMode"
            :locale-key="'settings.output.postprocessMode.options'"
            v-model="outputState.video.customPostprocessMode"
            class="mt-4"
        />

        <template v-if="showVideoPostprocessArgs">
          <label class="mb-2 mt-4 font-semibold" :for="fieldId('video-postprocess-args')">
            {{ t('settings.output.postprocessArgs.label') }}
          </label>
          <textarea
              :id="fieldId('video-postprocess-args')"
              v-model="outputState.video.postprocessArgs"
              class="textarea rounded-xl w-full"
              rows="3"
              :placeholder="t('settings.output.postprocessArgs.hint')"
          />
        </template>

        <p v-if="showMp42ContainerConflict" class="alert alert-error mt-2 alert-soft">
          {{ t('settings.output.postprocess.mp42RequiresMp4') }}
        </p>

        <p v-else-if="showKeepOriginalStreamsConflict" class="alert alert-error mt-2 alert-soft">
          {{ t('settings.output.postprocess.keepOriginalStreamsConflict') }}
        </p>

        <p v-if="showReencodeWarning" class="alert alert-warning mt-2 alert-soft">
          {{ t('settings.output.postprocess.reencodeWarning') }}
        </p>

        <slot name="video-extra" />
      </template>

      <template #audio>
        <h2 class="sr-only">
          {{ t('settings.output.tabs.audio.screenreader') }}
        </h2>

        <base-select
            :label="t('settings.output.tabs.audio.format.label')"
            :hint="t('settings.output.tabs.audio.format.hint')"
            :options="AudioFormat"
            :locale-key="'settings.output.tabs.audio.format.options'"
            v-model="outputState.audio.format"
            class="mb-4"
        />

        <div class="mb-4 flex flex-col gap-1">
          <label class="font-semibold" :for="fieldId('keep-original-streams-audio')">
            {{ t('settings.output.keepOriginalStreams.label') }}
          </label>
          <input
              :id="fieldId('keep-original-streams-audio')"
              type="checkbox"
              v-model="keepOriginalStreamsAudio"
              class="toggle toggle-primary my-1"
          />
          <p class="label">
            {{ t('settings.output.keepOriginalStreams.hint') }}
          </p>
        </div>

        <base-select
            :label="t('settings.output.tabs.audio.postprocess.label')"
            :hint="t('settings.output.postprocess.hint')"
            :options="AudioPostprocessPreset"
            :locale-key="'settings.output.tabs.audio.postprocess.options'"
            v-model="outputState.audio.postprocessPreset"
        />

        <template v-if="showAudioPostprocessArgs">
          <label class="mb-2 mt-4 font-semibold" :for="fieldId('audio-postprocess-args')">
            {{ t('settings.output.postprocessArgs.label') }}
          </label>
          <textarea
              :id="fieldId('audio-postprocess-args')"
              v-model="outputState.audio.postprocessArgs"
              class="textarea rounded-xl w-full"
              rows="3"
              :placeholder="t('settings.output.postprocessArgs.hint')"
          />
        </template>

        <slot name="audio-extra" />
      </template>
    </base-tabbed-pane>

    <div class="mt-4 mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="fieldId('add-thumbnail')">
        {{ t('settings.output.addThumbnail.label') }}
      </label>
      <input
          :id="fieldId('add-thumbnail')"
          type="checkbox"
          v-model="outputState.addThumbnail"
          class="toggle toggle-primary my-1"
      />
      <p class="label">
        {{ t('settings.output.addThumbnail.hint') }}
      </p>
    </div>

    <div class="mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="fieldId('add-thumbnail')">
        {{ t('settings.output.saveThumbnail.label') }}
      </label>
      <input
          :id="fieldId('save-thumbnail')"
          type="checkbox"
          v-model="outputState.saveThumbnail"
          class="toggle toggle-primary my-1"
      />
      <p class="label">
        {{ t('settings.output.saveThumbnail.hint') }}
      </p>
    </div>

    <div class="mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="fieldId('add-metadata')">
        {{ t('settings.output.addMetadata.label') }}
      </label>
      <input
          :id="fieldId('add-metadata')"
          type="checkbox"
          v-model="outputState.addMetadata"
          class="toggle toggle-primary my-1"
      />
      <p class="label">
        {{ t('settings.output.addMetadata.hint') }}
      </p>
    </div>

    <div v-if="showPreciseCuts" class="mb-4 flex flex-col gap-1">
      <label class="font-semibold" :for="fieldId('precise-cuts')">
        {{ t('settings.output.preciseCuts.label') }}
      </label>
      <input
          :id="fieldId('precise-cuts')"
          type="checkbox"
          v-model="outputState.preciseCuts"
          class="toggle toggle-primary my-1"
      />
      <p class="label whitespace-pre-line">
        {{ t('settings.output.preciseCuts.hint') }}
      </p>
    </div>

    <slot name="after-common" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseSelect from '../base/BaseSelect.vue';
import BaseTabbedPane from '../base/BaseTabbedPane.vue';
import type { OutputSettings } from '../../tauri/types/config.ts';
import {
  AudioFormat,
  AudioPostprocessPreset,
  VideoContainer,
  VideoPostprocessMode,
  VideoPostprocessPreset,
} from '../../tauri/types/media.ts';
import { useOutputSettingsEditor } from '../../composables/useOutputSettingsEditor.ts';

const outputState = defineModel<OutputSettings>({ required: true });

const { idPrefix } = defineProps({
  idPrefix: {
    type: String,
    required: false,
    default: '',
  },
  showPreciseCuts: {
    type: Boolean,
    required: false,
    default: true,
  },
});

const { t } = useI18n();
const {
  activeTab,
  tabs,
  keepOriginalStreamsVideo,
  keepOriginalStreamsAudio,
  postprocessHint,
  showVideoPostprocessArgs,
  showVideoPostprocessMode,
  showAudioPostprocessArgs,
  showReencodeWarning,
  showKeepOriginalStreamsConflict,
  showMp42ContainerConflict,
} = useOutputSettingsEditor(outputState);

const tabIdPrefix = computed(() => idPrefix || 'output');

const fieldId = (name: string) => idPrefix ? `${idPrefix}-${name}` : name;
</script>
