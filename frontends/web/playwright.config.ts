import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.test.ts'],
  webServer: [
    {
      command: 'make -C ../.. webdev',
      port: 8080,
      reuseExistingServer: true,
    },
  ],
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure', 
    trace: 'retain-on-failure',
  },
  reporter: [['html', { open: 'never' }], ['list']],
  outputDir: 'test-results/',
});
