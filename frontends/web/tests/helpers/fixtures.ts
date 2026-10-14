// SPDX-License-Identifier: Apache-2.0

import { test as baseTest } from '@playwright/test';
import { startRatesServer } from './rates';

// Custom fixtures for host/ports and optional fixed exchange rates.
export const test = baseTest.extend<{
  host: string;
  frontendPort: number;
  servewalletPort: number;
  ratesURL: string;
}>({
  host: process.env.HOST || 'localhost',
  frontendPort: parseInt(process.env.FRONTEND_PORT || '8080', 10),
  servewalletPort: parseInt(process.env.SERVE_WALLET_PORT || '8082', 10),
  // Playwright requires destructuring even for fixtures without dependencies.
  // eslint-disable-next-line no-empty-pattern
  ratesURL: async ({}, runTest) => {
    const server = await startRatesServer();
    try {
      await runTest(server.url);
    } finally {
      await server.close();
    }
  },
});

