import { Page, test as testBase } from '@playwright/test';
import MCR, { CoverageReportOptions } from 'monocart-coverage-reports';
import * as path from 'node:path';
import { MockData } from './mockData';

export const coverageOptions: CoverageReportOptions = {
  name: 'Playwright Coverage Report',
  reports: [
    'console-details',
    'html',
    'lcovonly',
  ],
  entryFilter: {
    '**/node_modules/**': false,
    '**/*.ts': true,
    '**/*.vue': true,
  },
  sourceFilter: {
    '**/node_modules/**': false,
    '**/*.ts': true,
    '**/*.vue': true,
  },
  outputDir: './coverage/e2e',
  sourcePath: (filePath, info) => {
    if (!filePath.includes('/') && info.distFile) {
      return `${path.dirname(info.distFile)}/${filePath}`;
    }
    return filePath;
  },
};

export type Options = { mockData: MockData };
export type Fixtures = {
  autoTestFixture: string;
  applyMockData: MockData;
};

const test = testBase.extend<Options & Fixtures>({
  mockData: [{}, { option: true }],
  autoTestFixture: [async ({ context }, use) => {
    const isChromium = test.info().project.name === 'chromium';

    const handlePageEvent = async (page: Page) => {
      await Promise.all([
        page.coverage.startJSCoverage({
          resetOnNavigation: false,
        }),
      ]);
    };

    if (isChromium) {
      context.on('page', handlePageEvent);
    }

    await use('autoTestFixture');

    if (isChromium) {
      context.off('page', handlePageEvent);
      const coverageList = (await Promise.all(context.pages().map(async (page) => {
        return await page.coverage.stopJSCoverage();
      }))).flat().filter((cov) => {
        return !cov.url.endsWith('.css') && !cov.url.includes('tests/');
      }).map((cov) => {
        return {
          ...cov,
          url: cov.url.replace(/\/\/localhost:\d+/, ''),
        };
      });
      const mcr = MCR(coverageOptions);
      await mcr.add(coverageList);
    }
  },
  {
    scope: 'test',
    auto: true,
  }],
  page: async ({ mockData, page }, use) => {
    await page.addInitScript((mockData: MockData) => {
      window.E2E = mockData;
    }, mockData);
    await use(page);
  },
});

export { test };
