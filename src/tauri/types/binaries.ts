export interface BinaryCheckPayload {
  tools: string[];
  dependencies?: DependencyReport[];
  warning?: string | null;
}

export interface BinaryDownloadStartPayload {
  tool: string;
  version: string;
}

export interface BinaryDownloadProgressPayload {
  tool: string;
  received: number;
  total: number;
}

export interface BinaryDownloadCompletePayload {
  tool: string;
}

export interface BinaryDownloadErrorPayload {
  tool: string;
  version: string;
  stage: string;
  error: string;
}

export interface BinaryUpdateCompletePayload {
  successes: string[];
  failures: BinaryDownloadErrorPayload[];
  error?: string;
}

export interface BinaryProgress {
  received: number;
  total: number;
  percent: number;
  error?: string;
  version?: string;
}

export const dependencyNames = ['yt-dlp', 'ffmpeg', 'ffprobe', 'deno', 'AtomicParsley'] as const;
export type DependencyStatus = 'compatible' | 'outdatedCompatible' | 'missing' | 'incompatible' | 'unableToExecute' | 'configuredInvalid' | 'unavailable';
export interface ResolvedDependency {
  tool: string;
  path: string;
  source: 'configured' | 'system' | 'bundled' | 'managed';
  version: string;
  status: DependencyStatus;
  compatibility: string;
}
export interface DependencyReport {
  tool: string;
  locked?: boolean;
  active: ResolvedDependency | null;
  status: DependencyStatus;
  diagnostics: { path: string; status: DependencyStatus; reason: string }[];
}
