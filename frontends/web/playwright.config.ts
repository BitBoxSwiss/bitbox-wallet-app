import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Read defaults from environment variables if set, otherwise fallback
const HOST = process.env.HOST || 'localhost';
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '8080', 10);
const PLAYWRIGHT_SLOW_MO = parseInt(process.env.PLAYWRIGHT_SLOW_MO || '0', 10);

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.test.ts'],
  webServer: [
    {
      command: `make -C ../.. buildweb && make -C ../.. webserve`,
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  timeout: 120_000,
  workers: 1, // Tests are not parallel-safe yet.
  use: {
    baseURL: `http://${HOST}:${FRONTEND_PORT}`,
    headless: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      // By default, tests are not run in slow motion.
      // Can be enabled by setting the PLAYWRIGHT_SLOW_MO environment variable to a value > 0.
      // This is useful for running tests locally.
      slowMo: PLAYWRIGHT_SLOW_MO,
    },
  },
  reporter: [['html', { open: 'never' }], ['list']],
  outputDir: 'test-results/',
  retries: 3,
  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'WebKit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
