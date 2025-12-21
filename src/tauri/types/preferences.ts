import { TrackType } from './media.ts';

export interface PathPreferences {
  recent: Record<string, string[]>;
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
};

export const defaultFormatPreferences: FormatPreferences = {
  trackType: TrackType.both,
};

export const defaultPreferences: Preferences = {
  paths: defaultPathPreferences,
  formats: defaultFormatPreferences,
};
