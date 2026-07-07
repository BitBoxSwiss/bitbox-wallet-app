// SPDX-License-Identifier: Apache-2.0

import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';

let servewallet: ServeWallet | undefined;

const cacheDir = path.join(process.cwd(), '../../appfolder.dev/cache');
const sentinelPath = path.join(cacheDir, 'playwright-clear-cache-sentinel.txt');
const exchangeRatesCacheDir = path.join(cacheDir, 'exchangerates');

const removeCacheDir = () => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
};

test('Clear cache removes cached files and recreates cache-backed state', async ({
  page,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir);
    await servewallet.start();
  });

  await test.step('Navigate to the app', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    await expect(page.locator('body')).toContainText('Please connect your BitBox and tap the side to continue.');
  });

  await test.step('Create a cache sentinel file', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(sentinelPath, `clear-cache-e2e-${Date.now()}`);
    expect(fs.existsSync(sentinelPath)).toBe(true);
  });

  await test.step('Clear cache from advanced settings', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Advanced settings' }).click();
    await page.getByRole('button', { name: /Clear cache/i }).click();

    await expect(page.getByRole('heading', { name: 'Clear cache' })).toBeVisible();

    const responsePromise = page.waitForResponse(response => (
      response.url().endsWith('/api/clear-cache')
      && response.request().method() === 'POST'
    ));

    await page.getByRole('button', { name: 'Clear Cache', exact: true }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  await test.step('Verify backend cache was cleared and reinitialized', async () => {
    await expect.poll(() => fs.existsSync(sentinelPath)).toBe(false);
    expect(fs.existsSync(exchangeRatesCacheDir)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Clear cache' })).toBeHidden();
  });
});

test.beforeEach(() => {
  deleteAccountsFile();
  deleteConfigFile();
  removeCacheDir();
});

test.afterEach(async () => {
  await servewallet?.stop();
  servewallet = undefined;
  fs.rmSync(sentinelPath, { force: true });
  deleteAccountsFile();
  deleteConfigFile();
});
