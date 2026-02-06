export interface MediaProgressStagePayload {
  id: string;
  groupId: string;
  stage: ProgressStage;
}

export interface MediaProgressPayload {
  id: string;
  groupId: string;
  category: ProgressCategory;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBps?: number;
  etaSecs?: number;
}

export interface MediaProgressPayload {
  id: string;
  groupId: string;
  category: ProgressCategory;
  percentage?: number;
  speedBps?: number;
  etaSecs?: number;
}

export interface MediaGroupProgressPayload extends MediaItemsProgress {
  id: string;
  groupId: string;
  speedBps?: number;
}

export interface MediaItemsProgress {
  total?: number;
  ready?: number;
  done?: number;
  downloading?: number;
}

export interface MediaProgressCompletePayload {
  id: string;
  groupId: string;
}

export enum ProgressCategory {
  video = 'video',
  audio = 'audio',
  subtitles = 'subtitles',
  thumbnail = 'thumbnail',
  metadata = 'metadata',
  other = 'other',
}

export enum ProgressStage {
  initializing = 'initializing',
  downloading = 'downloading',
  merging = 'merging',
  finalizing = 'finalizing',
}

export enum ProgressStyle {
  primary = 'progress-primary',
  warning = 'progress-warning',
  error = 'progress-error',
}
