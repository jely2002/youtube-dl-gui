export interface UpdaterCheckPayload {
  available: boolean;
  currentVersion: string;
  availableVersion?: string;
}

export interface UpdaterDownloadProgressPayload {
  received: number;
  total: number;
}
