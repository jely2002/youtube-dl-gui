import MCR from 'monocart-coverage-reports';
import { coverageOptions } from './fixtures';

function setup() {
  const mcr = MCR(coverageOptions);
  mcr.cleanCache();
}

export default setup;
