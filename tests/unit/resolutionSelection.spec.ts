import { describe, expect, it } from 'vitest';
import {
  buildCodecOptions,
  buildTrackOptions,
  buildTrackResolutionLabels,
  matchDownloadOptionsToFormat,
  resolveSelectableValue,
} from '../../src/helpers/resolutionSelection';
import { DownloadOptions, MediaCodec, MediaFormat, MediaTrack, TrackType } from '../../src/tauri/types/media';

describe('buildCodecOptions', () => {
  it('uses backend codec labels directly', () => {
    const codecs: MediaCodec[] = [
      { id: 'avc1.640028', label: 'H.264 High, Level 4.0' },
      { id: 'av01.0.08M.10', label: 'AV1 Main, Level 2.0, 10-bit' },
      { id: 'avc1.640028', label: 'Duplicate entry' },
    ];

    expect(buildCodecOptions(codecs)).toEqual([
      { value: 'av01.0.08M.10', label: 'AV1 Main, Level 2.0, 10-bit' },
      { value: 'avc1.640028', label: 'H.264 High, Level 4.0' },
    ]);
  });
});

describe('resolveSelectableValue', () => {
  const options = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French', disabled: true },
  ];

  it('keeps a valid selection', () => {
    expect(resolveSelectableValue('en', options, false)).toBe('en');
  });

  it('clears an invalid selection when auto-select is off', () => {
    expect(resolveSelectableValue('fr', options, false)).toBe('');
  });

  it('picks the first enabled option when auto-select is on', () => {
    expect(resolveSelectableValue('fr', options, true)).toBe('en');
  });
});

describe('buildTrackOptions', () => {
  const tracks: MediaTrack[] = [
    { id: 'lang:fr|channels:2', label: 'French stereo', language: 'fr', audioChannels: 2 },
    { id: 'lang:en|channels:2', label: 'English stereo', language: 'en', audioChannels: 2 },
  ];
  const formats: MediaFormat[] = [
    {
      id: '1080p60',
      height: 1080,
      fps: 60,
      videoCodecs: [],
      audioTrackIds: ['lang:fr|channels:2'],
      videoTrackIds: ['lang:fr|channels:2'],
    },
    {
      id: '720p30',
      height: 720,
      fps: 30,
      videoCodecs: [],
      audioTrackIds: ['lang:fr|channels:2', 'lang:en|channels:2'],
      videoTrackIds: ['lang:fr|channels:2', 'lang:en|channels:2'],
    },
  ];

  it('marks unavailable tracks as disabled and keeps available tracks first', () => {
    const options = buildTrackOptions(
      tracks,
      ['lang:en|channels:2'],
      buildTrackResolutionLabels(formats, 'audioTrackIds'),
      'Unavailable for selected resolution',
      'Available in',
    );

    expect(options).toEqual([
      {
        value: 'lang:en|channels:2',
        label: 'English - 2ch',
        disabled: false,
      },
      {
        value: 'lang:fr|channels:2',
        label: 'French - 2ch (Available in 1080p60, 720p30)',
        disabled: true,
      },
    ]);
  });
});

describe('matchDownloadOptionsToFormat', () => {
  const formats: MediaFormat[] = [
    {
      id: '720p30',
      height: 720,
      fps: 30,
      videoCodecs: [{ id: 'avc1.64001f', label: 'H.264 High, Level 3.1' }],
      audioTrackIds: ['lang:en|channels:2'],
      videoTrackIds: ['lang:en|channels:2'],
    },
    {
      id: '480k',
      abr: 480,
      videoCodecs: [{ id: 'aac', label: 'AAC' }],
      audioTrackIds: ['lang:fr|channels:2'],
      videoTrackIds: [],
    },
  ];

  it('returns the audio best placeholder when no audio quality is selected', () => {
    const options: DownloadOptions = { trackType: TrackType.audio };
    expect(matchDownloadOptionsToFormat(formats, options)).toEqual({
      id: 'best',
      videoCodecs: [],
      audioTrackIds: [],
      videoTrackIds: [],
    });
  });

  it('matches an exact video format', () => {
    const options: DownloadOptions = { trackType: TrackType.video, height: 720, fps: 30 };
    expect(matchDownloadOptionsToFormat(formats, options)).toEqual(formats[0]);
  });
});
