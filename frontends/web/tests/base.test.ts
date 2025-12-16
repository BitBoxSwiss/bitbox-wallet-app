// SPDX-License-Identifier: Apache-2.0

import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { expect } from '@playwright/test';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';

let servewallet: ServeWallet;

test('App main page loads', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name);
    await servewallet.start();
  });


  await test.step('Navigate to the app', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    const body = page.locator('body');
    await expect(body).toContainText('Please connect your BitBox and tap the side to continue.'),
    { timeout: 15000 };
  });
});

test.beforeAll(async () => {
  deleteAccountsFile();
  deleteConfigFile();
});

test.afterAll(async () => {
  await servewallet.stop();
});
