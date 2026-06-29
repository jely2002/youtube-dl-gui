import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useMediaResolutionSelection } from '../../src/composables/useMediaResolutionSelection';
import { DownloadOptions, MediaCodec, MediaFormat, MediaTrack, TrackType } from '../../src/tauri/types/media';

describe('useMediaResolutionSelection', () => {
  const audioCodecs: MediaCodec[] = [
    { id: 'mp4a.40.5', label: 'HE-AAC v1' },
    { id: 'mp4a.40.2', label: 'AAC LC' },
    { id: 'opus', label: 'Opus' },
  ];

  const formats: MediaFormat[] = [
    {
      id: '49k',
      abr: 49,
      audioCodecs: [{ id: 'mp4a.40.5', label: 'HE-AAC v1' }],
      videoCodecs: [],
      audioTrackIds: [],
      videoTrackIds: [],
    },
    {
      id: '130k',
      abr: 130,
      audioCodecs: [
        { id: 'mp4a.40.2', label: 'AAC LC' },
        { id: 'opus', label: 'Opus' },
      ],
      videoCodecs: [],
      audioTrackIds: [],
      videoTrackIds: [],
    },
    {
      id: '720p30',
      height: 720,
      fps: 30,
      audioCodecs: [{ id: 'mp4a.40.2', label: 'AAC LC' }],
      videoCodecs: [{ id: 'vp9', label: 'VP9' }],
      audioTrackIds: [],
      videoTrackIds: [],
    },
  ];
  const audioTracks: MediaTrack[] = [
    { id: 'lang:en|channels:2', label: 'English stereo', language: 'en', audioChannels: 2 },
  ];

  function createSelection(selectedOptions: DownloadOptions | undefined) {
    return useMediaResolutionSelection({
      formats,
      audioCodecs,
      videoCodecs: [],
      audioTracks,
      videoTracks: [],
      selectedOptions: ref(selectedOptions),
      approximate: false,
      unavailableTrackSuffix: computed(() => 'Unavailable'),
      availableTrackPrefix: computed(() => 'Available in'),
    });
  }

  it('narrows audio codec options to the selected audio bitrate', () => {
    const { audioCodecOptions } = createSelection({
      trackType: TrackType.audio,
      abr: 130,
    });

    expect(audioCodecOptions.value).toEqual([
      { value: 'mp4a.40.2', label: 'AAC LC' },
      { value: 'opus', label: 'Opus' },
    ]);
  });

  it('falls back to the full audio codec list when no audio format is selected', () => {
    const { audioCodecOptions } = createSelection({
      trackType: TrackType.audio,
    });

    expect(audioCodecOptions.value).toEqual([
      { value: 'mp4a.40.2', label: 'AAC LC' },
      { value: 'mp4a.40.5', label: 'HE-AAC v1' },
      { value: 'opus', label: 'Opus' },
    ]);
  });

  it('keeps tracks selectable for best audio', () => {
    const { audioTrackOptions } = createSelection({
      trackType: TrackType.audio,
    });

    expect(audioTrackOptions.value).toEqual([
      {
        value: 'lang:en|channels:2',
        label: 'English - 2ch',
        disabled: false,
      },
    ]);
  });

  it('keeps the full audio codec list for combined video and audio selection', () => {
    const { selectedFormat, audioCodecOptions } = createSelection({
      trackType: TrackType.both,
      height: 720,
      fps: 30,
    });

    expect(selectedFormat.value).toMatchObject({
      id: '720p30',
      audioCodecs: [{ id: 'mp4a.40.2', label: 'AAC LC' }],
    });
    expect(audioCodecOptions.value).toEqual([
      { value: 'mp4a.40.2', label: 'AAC LC' },
      { value: 'mp4a.40.5', label: 'HE-AAC v1' },
      { value: 'opus', label: 'Opus' },
    ]);
  });
});
