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
  ogg = 'ogg',
  aac = 'aac',
  opus = 'opus',
}

export type DownloadOptions = {
  trackType: TrackType;
  asr?: number;
  height?: number;
  fps?: number;
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
  views?: number;
  comments?: number;
  likes?: number;
  dislikes?: number;
  duration?: number;
  rating?: number;
  extractor?: string;
  audioCodecs: string[];
  formats: MediaFormat[];
  isLeader?: boolean;
  groupId?: string;
  filesize: number;
  entries?: EntryItem[];
}

export interface EntryItem {
  index: number;
  videoUrl: string;
}

export interface MediaFormat {
  id: string;
  height?: number;
  asr?: number;
  fps?: number;
  videoCodecs: string[];
}
