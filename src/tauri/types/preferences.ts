import { TrackType } from './media.ts';

export interface PathPreferences {
  recent: Record<string, string[]>;
  audioDownloadDir: string | null;
  videoDownloadDir: string | null;
  videoDirectoryTemplate: string | null;
  audioDirectoryTemplate: string | null;
}

export interface FormatPreferences {
  trackType: TrackType;
}

export interface Preferences {
  paths: PathPreferences;
  formats: FormatPreferences;
}

export const defaultPathPreferences: PathPreferences = {
  recent: {},
  audioDownloadDir: null,
  videoDownloadDir: null,
  videoDirectoryTemplate: null,
  audioDirectoryTemplate: null,
};

export const defaultFormatPreferences: FormatPreferences = {
  trackType: TrackType.both,
};

export const defaultPreferences: Preferences = {
  paths: defaultPathPreferences,
  formats: defaultFormatPreferences,
};
