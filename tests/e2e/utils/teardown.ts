import MCR from 'monocart-coverage-reports';
import { coverageOptions } from './fixtures';

async function globalTeardown(): Promise<void> {
  const mcr = MCR(coverageOptions);
  await mcr.generate();
}

export default globalTeardown;
