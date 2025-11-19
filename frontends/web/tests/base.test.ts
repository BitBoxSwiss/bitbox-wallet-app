/**
*  Copyright 2025 Shift Crypto AG
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*       http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*/

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
