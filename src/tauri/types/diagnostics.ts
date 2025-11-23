interface MediaDiagnostic {
  id: string;
  groupId: string;
  level: 'error' | 'warning';
  code: string;
  component: string | null;
  message: string;
  raw: string;
  timestamp: number;
}

interface MediaFatal {
  id: string;
  groupId: string;
  exitCode: number | null;
  internal: boolean;
  message: string;
  details: string | null;
  timestamp: number;
}
