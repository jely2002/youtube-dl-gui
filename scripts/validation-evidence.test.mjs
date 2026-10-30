import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyApplicationEvidence } from './validation-evidence.mjs';

const expected = { platform: 'linux-x86_64', version: '3.2.1', commit: 'current-feature-head' };
const report = { status: 'passed', platform: expected.platform, appVersion: expected.version, sourceCommit: expected.commit };
test('packaged execution must prove the expected source, version and native platform', () => {
  assert.equal(verifyApplicationEvidence(report, expected), 'passed');
  for (const field of ['platform', 'appVersion', 'sourceCommit']) {
    assert.throws(() => verifyApplicationEvidence({ ...report, [field]: 'different' }, expected));
  }
  assert.throws(() => verifyApplicationEvidence({ ...report, status: 'failed' }, expected));
});
test('unavailable optional dependencies remain partial evidence, not full validation', () => {
  assert.equal(verifyApplicationEvidence({ ...report, status: 'partial' }, expected), 'partial');
});
