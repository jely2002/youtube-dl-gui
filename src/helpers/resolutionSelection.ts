import { TrackType, DownloadOptions, MediaCodec, MediaFormat, MediaTrack } from '../tauri/types/media';
import { SelectOption } from './forms';
import { approxAudio, approxVideo, sortFormats } from './formats';
import { languageOptionsLookup } from './subtitles/languages';

function normalizeCodec(codec: string): string {
  return codec.trim().toLowerCase();
}

function codecId(codec: MediaCodec): string {
  return typeof codec === 'string' ? codec : codec.id;
}

function codecLabel(codec: MediaCodec): string {
  return typeof codec === 'string' ? codec : (codec.label || codec.id);
}

export function matchDownloadOptionsToFormat(
  formats: MediaFormat[],
  options: DownloadOptions | undefined,
  approximate = false,
): MediaFormat | undefined {
  if (!options) return undefined;

  if (options.trackType === TrackType.audio) {
    if (!options.height && !options.fps && !options.abr) {
      return {
        id: 'best',
        videoCodecs: [],
        audioTrackIds: [],
        videoTrackIds: [],
      };
    }

    return (
      formats.find(f => f.abr === options.abr)
      || (approximate ? approxAudio(formats, options.abr) : undefined)
    );
  }

  return (
    formats.find(f => f.height === options.height && f.fps === options.fps)
    || (approximate ? approxVideo(formats, options.height, options.fps) : undefined)
  );
}

export function buildCodecOptions(codecs: MediaCodec[] | undefined): SelectOption[] {
  const deduped = new Map<string, MediaCodec>();
  for (const codec of codecs ?? []) {
    const id = codecId(codec).trim();
    if (!id) continue;
    const key = normalizeCodec(id);
    if (!deduped.has(key)) {
      deduped.set(key, typeof codec === 'string' ? codec : { id, label: codecLabel(codec) });
    }
  }
  return [...deduped.values()].sort((a, b) => codecLabel(a).localeCompare(codecLabel(b)) || codecId(a).localeCompare(codecId(b))).map(codec => ({
    value: codecId(codec),
    label: codecLabel(codec),
  }));
}

export function resolveSelectableValue(
  current: string,
  options: SelectOption[],
  autoSelect: boolean,
): string {
  const selected = options.find(option => option.value === current);
  if (selected && !selected.disabled) return current;

  if (!autoSelect) {
    return '';
  }

  return options.find(option => !option.disabled)?.value ?? '';
}

export function buildTrackOptions(
  tracks: MediaTrack[] | undefined,
  availableTrackIds: string[] | undefined,
  supportedTrackResolutions: Map<string, string[]> | undefined,
  unavailableSuffix: string,
  availableResolutionPrefix: string,
): SelectOption[] {
  const availableIds = new Set((availableTrackIds ?? []).map(id => id.trim()).filter(Boolean));
  const byId = new Map<string, { option: SelectOption; order: number; available: boolean }>();

  tracks?.forEach((track, index) => {
    if (!track?.id || track.id === 'auto') return;

    const baseLabel = formatTrackLabel(track);
    const available = availableIds.size === 0 ? false : availableIds.has(track.id);
    const supportedResolutions = supportedTrackResolutions?.get(track.id) ?? [];
    const unavailableLabel = supportedResolutions.length
      ? `${availableResolutionPrefix} ${supportedResolutions.join(', ')}`
      : unavailableSuffix;
    const option: SelectOption = {
      value: track.id,
      label: available ? baseLabel : `${baseLabel} (${unavailableLabel})`,
      disabled: !available,
    };

    const existing = byId.get(track.id);
    if (!existing) {
      byId.set(track.id, { option, order: index, available });
      return;
    }

    if (!existing.available && available) {
      byId.set(track.id, { option, order: existing.order, available });
    }
  });

  const ordered = [...byId.values()];
  const available = ordered.filter(item => item.available);
  const unavailable = ordered.filter(item => !item.available);
  const sortByOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

  return [...available.sort(sortByOrder), ...unavailable.sort(sortByOrder)]
    .map(item => item.option);
}

export function buildTrackResolutionLabels(
  formats: MediaFormat[] | undefined,
  trackKey: 'audioTrackIds' | 'videoTrackIds',
): Map<string, string[]> {
  const labelsByTrack = new Map<string, string[]>();
  for (const format of sortFormats(formats ?? [])) {
    const label = formatResolutionLabel(format);
    for (const trackId of format[trackKey] ?? []) {
      const trimmed = trackId.trim();
      if (!trimmed || trimmed === 'auto') continue;

      const labels = labelsByTrack.get(trimmed) ?? [];
      if (!labels.includes(label)) {
        labels.push(label);
      }
      labelsByTrack.set(trimmed, labels);
    }
  }

  return labelsByTrack;
}

function formatTrackLabel(track: MediaTrack): string {
  if (track.id === 'auto') return track.label || 'Auto';

  const parts: string[] = [];
  const languageName = resolveLanguageName(track.language);
  if (languageName) parts.push(languageName);
  if (track.audioChannels) parts.push(`${track.audioChannels}ch`);

  if (parts.length > 0) return parts.join(' - ');
  return track.label || track.id;
}

function resolveLanguageName(language: string | undefined): string | undefined {
  if (!language) return undefined;

  const normalized = language.trim().replace('_', '-');
  if (!normalized) return undefined;

  const exact = languageOptionsLookup.get(normalized)
    || languageOptionsLookup.get(normalized.toLowerCase());
  if (exact) return exact.englishName;

  const base = normalized.split('-')[0]?.toLowerCase();
  if (!base) return normalized;
  return languageOptionsLookup.get(base)?.englishName ?? normalized;
}

function formatResolutionLabel(format: MediaFormat): string {
  if (format.height != null) {
    return format.fps ? `${format.height}p${format.fps}` : `${format.height}p`;
  }

  if (format.abr != null) {
    return `${format.abr}kbps`;
  }

  return format.id;
}
