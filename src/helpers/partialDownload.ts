import { Chapter, OutputOverrides, PartialDownload, Section } from '../tauri/types/media';

export type SelectionErrorKey = 'invalid' | 'beforeStart' | 'exceedsDuration';

export type SelectionValidation = {
  start: SelectionErrorKey | null;
  end: SelectionErrorKey | null;
};

export interface PartialDownloadSelection extends Section {
  mode: 'time' | 'chapter';
  chapterKey: string;
}

const ALL_CHAPTERS_VALUE = '__all__';

export function formatSecondsAsClock(totalSeconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;

  return [hours, minutes, seconds]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');
}

export function normalizeTimestampInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return formatSecondsAsClock(Number(trimmed));
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.some(part => !/^\d+$/.test(part))) return null;

  const numbers = parts.map(Number);
  const [hours, minutes, seconds] = parts.length === 3
    ? numbers
    : [0, numbers[0], numbers[1]];

  if (minutes > 59 || seconds > 59) return null;

  return formatSecondsAsClock((hours * 3600) + (minutes * 60) + seconds);
}

export function toSeconds(value: string): number | null {
  const normalized = normalizeTimestampInput(value);
  if (!normalized) return null;

  const [hours, minutes, seconds] = normalized.split(':').map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}

export function createDefaultSection(id: string, durationSeconds?: number): Section {
  return {
    id,
    start: '00:00:00',
    end: durationSeconds != null ? formatSecondsAsClock(durationSeconds) : '',
  };
}

export function createDefaultSelection(
  id: string,
  chapters: Chapter[],
  durationSeconds?: number,
): PartialDownloadSelection {
  return {
    ...createDefaultSection(id, durationSeconds),
    mode: chapters.length > 0 ? 'chapter' : 'time',
    chapterKey: chapters.length > 0 ? ALL_CHAPTERS_VALUE : '',
  };
}

export function getChapterKeyForSection(
  section: Pick<Section, 'start' | 'end'>,
  chapters: Chapter[],
): string | undefined {
  const index = chapters.findIndex(chapter =>
    formatSecondsAsClock(Math.floor(chapter.startTime)) === section.start
    && formatSecondsAsClock(Math.floor(chapter.endTime)) === section.end,
  );

  if (index === -1) return undefined;

  const chapter = chapters[index];
  return `${index}:${chapter.startTime}:${chapter.endTime}`;
}

export function createSelectionFromSection(
  section: Section | undefined,
  fallbackId: string,
  chapters: Chapter[],
  durationSeconds?: number,
): PartialDownloadSelection {
  const base = section ?? createDefaultSection(fallbackId, durationSeconds);
  const chapterKey = section ? getChapterKeyForSection(base, chapters) : undefined;

  return {
    ...base,
    mode: chapterKey ? 'chapter' : (section ? 'time' : (chapters.length > 0 ? 'chapter' : 'time')),
    chapterKey: chapterKey ?? (chapters.length > 0 ? ALL_CHAPTERS_VALUE : ''),
  };
}

export function validateSelection(
  selection: Pick<Section, 'start' | 'end'>,
  durationSeconds?: number,
): SelectionValidation {
  const normalizedStart = normalizeTimestampInput(selection.start);
  const normalizedEnd = normalizeTimestampInput(selection.end);

  if (!normalizedStart) {
    return { start: 'invalid', end: null };
  }

  if (!normalizedEnd) {
    return { start: null, end: 'invalid' };
  }

  const startSeconds = toSeconds(normalizedStart);
  const endSeconds = toSeconds(normalizedEnd);
  if (startSeconds == null || endSeconds == null) {
    return { start: 'invalid', end: 'invalid' };
  }

  if (durationSeconds != null) {
    if (startSeconds > durationSeconds) {
      return { start: 'exceedsDuration', end: null };
    }
    if (endSeconds > durationSeconds) {
      return { start: null, end: 'exceedsDuration' };
    }
  }

  if (endSeconds <= startSeconds) {
    return { start: null, end: 'beforeStart' };
  }

  return { start: null, end: null };
}

export function normalizeValidSection(section: Section): Section | null {
  const normalizedStart = normalizeTimestampInput(section.start);
  const normalizedEnd = normalizeTimestampInput(section.end);
  if (!normalizedStart || !normalizedEnd) return null;

  return {
    ...section,
    start: normalizedStart,
    end: normalizedEnd,
  };
}

export function buildDownloadSectionsValues(section?: Section): string[] {
  if (!section) return [];
  return [`*${section.start}-${section.end}`];
}

export function isDefaultTimeRange(
  selection: Pick<Section, 'start' | 'end'>,
  durationSeconds?: number,
): boolean {
  const defaultSection = createDefaultSection('default', durationSeconds);
  return selection.start === defaultSection.start && selection.end === defaultSection.end;
}

export function buildPartialDownloadOverride(
  selection: PartialDownloadSelection | undefined,
  durationSeconds?: number,
): OutputOverrides['partialDownload'] | undefined {
  if (!selection) return undefined;

  if (selection.mode === 'chapter') {
    return selection.chapterKey === ALL_CHAPTERS_VALUE
      ? undefined
      : toPartialDownloadPayload([{ id: selection.id, start: selection.start, end: selection.end }], durationSeconds);
  }

  if (isDefaultTimeRange(selection, durationSeconds)) {
    return undefined;
  }

  return toPartialDownloadPayload(
    [{ id: selection.id, start: selection.start, end: selection.end }],
    durationSeconds,
  );
}

export function toPartialDownloadPayload(
  sections: Section[],
  durationSeconds?: number,
): PartialDownload | undefined {
  const hasInvalidSection = sections.some((section) => {
    const errors = validateSelection(section, durationSeconds);
    return errors.start !== null || errors.end !== null;
  });

  return {
    section: hasInvalidSection
      ? undefined
      : sections
          .slice(0, 1)
          .map(normalizeValidSection)
          .find((section): section is Section => section !== null),
  };
}
