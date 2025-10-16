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
test('Testnet mode', async ({ page, host, frontendPort, servewalletPort }) => {

    await test.step('Start servewallet', async () => {
        servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, { testnet: false })
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

    await test.step('Restart servewallet', async () => {
        await servewallet.restart();
    });

    await test.step('Verify testnet is still enabled', async () => {
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
