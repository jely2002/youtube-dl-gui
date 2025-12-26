export interface NavigatePayload {
  route: string;
}

export enum Platform {
  Windows = 'windows',
  MacOS = 'macos',
  Linux = 'linux',
  Unknown = 'unknown',
}
