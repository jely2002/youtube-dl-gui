export interface NavigatePayload {
  route: string;
}

export enum Platform {
  Windows = 'windows',
  MacOS = 'macos',
  Linux = 'linux',
  Unknown = 'unknown',
}

export enum NotificationKind {
  QueueAdded = 'queueAdded',
  QueueDownloading = 'queueDownloading',
  QueueFinished = 'queueFinished',
  VideoFinished = 'videoFinished',
  PlaylistFinished = 'playlistFinished',
  DownloadFailed = 'downloadFailed',
  VideoReady = 'videoReady',
  PlaylistReady = 'playlistReady',
}
