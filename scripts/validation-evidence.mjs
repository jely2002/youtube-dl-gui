// Packaging can transform executable bytes; identity and successful execution
// must still match the requested build. Keep raw hashes as separate evidence.
export function verifyApplicationEvidence(report, expected) {
  if (!['passed', 'partial'].includes(report.status)) throw new Error('Application validation did not pass its required checks');
  if (report.platform !== expected.platform) throw new Error('Packaged application platform mismatch');
  if (report.appVersion !== expected.version) throw new Error('Packaged application version mismatch');
  if (expected.commit && report.sourceCommit !== expected.commit) throw new Error('Packaged application source commit mismatch');
  return report.status;
}
