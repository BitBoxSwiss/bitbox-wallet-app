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


import { deleteConfigFile } from './helpers/fs';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

let servewallet: ServeWallet;


/**
 * Test logic:
 * - Start servewallet in mainnet mode
 * - Enable testnet mode by clicking the toggle in settings
 * - Kill servewallet
 * - Restart servewallet in mainnet mode - the config has the priority so it should be in testnet mode.
 * - Disable testnet mode by clicking the toggle in settings
 * - Kill servewallet
 * - Restart servewallet in mainnet mode - testnet mode should be disabled now.
 */
test('Testnet mode', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name, { testnet: false });
    await servewallet.start();
  });

  await test.step('Verify testnet is not enabled, and enable it', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    const body = page.locator('body');
    await expect(body).not.toContainText('Testnet');

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Advanced settings' }).click();
    await page.getByRole('button', { name: 'Start testnet mode' }).click();

  });

  // In Github CI, we have seen that sometimes the config.json file takes a bit
  // to be updated, so we wait here until we see the change.
  await test.step('wait for startInTestnet=true', async () => {
    const configPath = path.join(process.cwd(), '../../appfolder.dev/config.json');
    const timeoutMs = 5000; // max wait time
    const intervalMs = 100; // check every 100ms

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const content = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(content);

      if (json.backend.startInTestnet === true) {
        console.log('startInTestnet is now true!');
        return;
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error('Timeout: startInTestnet did not become true within 5s');
  });

  await test.step('Restart servewallet', async () => {
    await servewallet.restart();
  });

  await test.step('Verify testnet is enabled', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    const body = page.locator('body');
    await expect(body).toContainText('Testnet');
  });

  await test.step('Disable testnet mode', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Advanced settings' }).click();
    await page.getByRole('button', { name: 'Exit testnet mode' }).click();
  });

  await test.step('Restart servewallet', async () => {
    await servewallet.restart();
  });

  await test.step('Verify testnet is disabled', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    const body = page.locator('body');
    await expect(body).not.toContainText('Testnet');
  });
});

// Kill the simulator after each run and delete the config file to ensure a clean state.
test.afterEach(() => {
  servewallet.stop();
  deleteConfigFile();
});
