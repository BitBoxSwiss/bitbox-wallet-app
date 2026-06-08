// SPDX-License-Identifier: Apache-2.0

import { test as baseTest } from '@playwright/test';

// Custom fixtures for host/ports
export const test = baseTest.extend<{
  host: string;
  frontendPort: number;
  servewalletPort: number;
}>({
  host: process.env.HOST || 'localhost',
  frontendPort: parseInt(process.env.FRONTEND_PORT || '8080', 10),
  servewalletPort: parseInt(process.env.SERVE_WALLET_PORT || '8082', 10),
});

