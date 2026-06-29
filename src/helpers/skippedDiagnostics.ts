export const INPUT_FILTER_SKIPPED_CODE = 'input_filter_skipped';

export type GroupedSkippedDiagnostic = {
  message: string;
  count: number;
  diagnostics: MediaDiagnostic[];
};

export function isSkippedDiagnostic(diagnostic: MediaDiagnostic): boolean {
  return diagnostic.level === 'warning' && diagnostic.code === INPUT_FILTER_SKIPPED_CODE;
}

export function countSkippedDiagnostics(diagnostics: MediaDiagnostic[]): number {
  return diagnostics.filter(isSkippedDiagnostic).length;
}

export function groupSkippedDiagnostics(diagnostics: MediaDiagnostic[]): GroupedSkippedDiagnostic[] {
  const grouped = new Map<string, GroupedSkippedDiagnostic>();

  for (const diagnostic of diagnostics) {
    if (!isSkippedDiagnostic(diagnostic)) continue;

    const existing = grouped.get(diagnostic.message);
    if (existing) {
      existing.count += 1;
      existing.diagnostics.push(diagnostic);
      continue;
    }

    grouped.set(diagnostic.message, {
      message: diagnostic.message,
      count: 1,
      diagnostics: [diagnostic],
    });
  }

  return [...grouped.values()].sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
}
