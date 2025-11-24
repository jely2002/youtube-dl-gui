export interface BinaryCheckPayload {
  tools: string[];
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
