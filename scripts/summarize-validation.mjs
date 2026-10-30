import { appendFile, readdir, readFile } from 'node:fs/promises';

const reports = [];
try {
  for (const name of await readdir('validation-results')) {
    if (!name.endsWith('.json') || name === 'packaging.json') continue;
    reports.push({ name, data: JSON.parse(await readFile(`validation-results/${name}`, 'utf8')) });
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const rows = reports.map(({ name, data }) => `| ${name} | ${data.status} | ${data.checks?.length ?? 0} |`);
const optional = reports.flatMap(({ data }) => (data.assets ?? []).filter(asset => ['unavailable', 'rejected-incompatible'].includes(asset.status)));
const notes = [...new Set(optional.map(asset => `${asset.tool}: ${asset.status}${asset.binaryArchitecture ? ` (${asset.binaryArchitecture})` : ''}`))];
const summary = [
  '## Native validation evidence', '',
  '| Report | Result | Completed backend checks |', '| --- | --- | --- |', ...rows, '',
  ...(notes.length ? ['**Partial optional-tool coverage:**', ...notes.map(note => `- ${note}`), ''] : []),
  'Headless checks exercise the application dependency backend; GUI behavior is not claimed.', '',
].join('\n');
console.log(summary);
if (notes.length) console.log('::warning::Optional dependency coverage is partial. Inspect the native validation evidence.');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
