import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Read defaults from environment variables if set, otherwise fallback
const HOST = process.env.HOST || 'localhost';
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '8080', 10);

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
  use: {
    baseURL: `http://${HOST}:${FRONTEND_PORT}`,
    headless: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['html', { open: 'never' }], ['list']],
  outputDir: 'test-results/',
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
