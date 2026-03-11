export enum TrackType {
  both = 'both',
  audio = 'audio',
  video = 'video',
}

export enum TranscodePolicy {
  never = 'never',
  remuxOnly = 'remuxOnly',
  allowReencode = 'allowReencode',
}

export enum VideoContainer {
  mp4 = 'mp4',
  mkv = 'mkv',
}

export enum AudioFormat {
  mp3 = 'mp3',
  m4a = 'm4a',
  opus = 'opus',
  aac = 'aac',
  ogg = 'ogg',
  flac = 'flac',
  wav = 'wav',
}

export type DownloadOptions = {
  trackType: TrackType;
  abr?: number;
  height?: number;
  fps?: number;
  audioEncoding?: string;
  videoEncoding?: string;
  audioTrack?: string;
  videoTrack?: string;
};

export type EncodingOptions = {
  audio?: string;
  video?: string;
};

export type TrackOptions = {
  audio?: string;
  video?: string;
};

export interface MediaAddPayload {
  groupId: string;
  total: number;
  item: MediaItem;
}

export type MediaAddWithFormatPayload = MediaAddPayload & {
  format: DownloadOptions;
};

export interface MediaItem {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
  description?: string;
  uploader?: string;
  uploaderId?: string;
  views?: number;
  comments?: number;
  likes?: number;
  dislikes?: number;
  duration?: number;
  rating?: number;
  extractor?: string;
  audioCodecs: string[];
  videoCodecs?: string[];
  audioTracks?: MediaTrack[];
  videoTracks?: MediaTrack[];
  formats: MediaFormat[];
  isLeader?: boolean;
  groupId?: string;
  filesize: number;
  entries?: EntryItem[];
  playlistId?: string;
  playlistCount?: number;
  playlistIndex?: number;
}

export interface EntryItem {
  index: number;
  videoUrl: string;
}

export interface MediaFormat {
  id: string;
  height?: number;
  abr?: number;
  fps?: number;
  videoCodecs: string[];
}

export interface MediaTrack {
  id: string;
  label: string;
  language?: string;
  languagePreference?: number;
  formatNote?: string;
  format?: string;
  audioChannels?: number;
}
