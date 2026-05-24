import { computed, MaybeRefOrGetter, toValue } from 'vue';
import { DownloadOptions, MediaCodec, MediaFormat, MediaTrack, TrackType } from '../tauri/types/media';
import {
  buildCodecOptions,
  buildTrackOptions,
  buildTrackResolutionLabels,
  matchDownloadOptionsToFormat,
} from '../helpers/resolutionSelection';

type UseMediaResolutionSelectionParams = {
  formats: MaybeRefOrGetter<MediaFormat[]>;
  audioCodecs: MaybeRefOrGetter<MediaCodec[] | undefined>;
  videoCodecs: MaybeRefOrGetter<MediaCodec[] | undefined>;
  audioTracks: MaybeRefOrGetter<MediaTrack[] | undefined>;
  videoTracks: MaybeRefOrGetter<MediaTrack[] | undefined>;
  selectedOptions: MaybeRefOrGetter<DownloadOptions | undefined>;
  approximate?: MaybeRefOrGetter<boolean>;
  unavailableTrackSuffix: MaybeRefOrGetter<string>;
  availableTrackPrefix: MaybeRefOrGetter<string>;
};

export function useMediaResolutionSelection(params: UseMediaResolutionSelectionParams) {
  const selectedFormat = computed(() =>
    matchDownloadOptionsToFormat(
      toValue(params.formats),
      toValue(params.selectedOptions),
      toValue(params.approximate) ?? false,
    ),
  );
  const selectedTrackIds = computed(() =>
    selectedFormat.value?.id === 'best' ? undefined : selectedFormat.value,
  );
  const selectedAudioCodecSource = computed(() => {
    const options = toValue(params.selectedOptions);
    if (options?.trackType !== TrackType.audio) {
      return toValue(params.audioCodecs);
    }
    if (selectedFormat.value?.id === 'best') {
      return toValue(params.audioCodecs);
    }
    return selectedFormat.value?.audioCodecs ?? toValue(params.audioCodecs);
  });

  const audioCodecOptions = computed(() =>
    buildCodecOptions(selectedAudioCodecSource.value),
  );

  const videoCodecOptions = computed(() =>
    buildCodecOptions(
      selectedFormat.value?.videoCodecs ?? toValue(params.videoCodecs),
    ),
  );

  const audioTrackOptions = computed(() =>
    buildTrackOptions(
      toValue(params.audioTracks),
      selectedTrackIds.value?.audioTrackIds,
      buildTrackResolutionLabels(toValue(params.formats), 'audioTrackIds'),
      toValue(params.unavailableTrackSuffix),
      toValue(params.availableTrackPrefix),
    ),
  );

  const videoTrackOptions = computed(() =>
    buildTrackOptions(
      toValue(params.videoTracks),
      selectedTrackIds.value?.videoTrackIds,
      buildTrackResolutionLabels(toValue(params.formats), 'videoTrackIds'),
      toValue(params.unavailableTrackSuffix),
      toValue(params.availableTrackPrefix),
    ),
  );

  return {
    selectedFormat,
    audioCodecOptions,
    videoCodecOptions,
    audioTrackOptions,
    videoTrackOptions,
  };
}
