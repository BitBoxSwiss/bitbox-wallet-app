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
import { startSimulator, completeWalletSetupFlow, cleanFakeMemoryFiles } from './helpers/simulator';
import { assertFieldsCount, clickButtonWithText } from './helpers/dom';
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let servewallet: ServeWallet;
let simulatorProc : ChildProcessWithoutNullStreams | undefined;

/**
 * Test scenario 1:
 * - Unlock BB02 with no passphrase.
 * - Wait for accounts to load
 * - Disconnect BB02 (kill the simulator)
 * - Check that accounts disappear
 * - Restart app (kill and restart servewallet)
 * - Check that accounts do not show up without simulator running.
 */
test('Test #1 - No passphrase and no watch-only', async ({ page, host, frontendPort, servewalletPort }) => {
    await test.step('Start servewallet', async () => {
        servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, true)
        await servewallet.start();
    });

    await test.step('Start simulator', async () => {
        const simulatorPath = process.env.SIMULATOR_PATH;
        if (!simulatorPath) {
            throw new Error('SIMULATOR_PATH environment variable not set');
        }

        simulatorProc = startSimulator(simulatorPath, true);
        console.log('Simulator started');
    });

    await test.step('Initialize wallet', async () => {
        await completeWalletSetupFlow(page);
    });

    await test.step('Check that three accounts show up', async () => {
        // Wait for the three accounts to show up
        await assertFieldsCount(page, 'data-label', 'Account name', 3);
    });

    await test.step('Kill simulator', async () => {
        simulatorProc?.kill('SIGTERM');
        simulatorProc = undefined;
    });

    await test.step('Check that accounts disappear', async () => {
        await assertFieldsCount(page, 'data-label', 'Account name', 0);
    });

    await test.step('Restart servewallet', async () => {
        await servewallet.restart();
    });

    await test.step('Check that accounts do not show up without simulator', async () => {
        await assertFieldsCount(page, 'data-label', 'Account name', 0);
    });

});

/**
 * Test scenario 2:
 * - Unlock BB02 with no passphrase.
 * - Wait for accounts to load
 * - Enable "Remember wallet" (watch-only)
 * - Disconnect BB02 (kill the simulator)
 * - Check that watch-only accounts show up
 * - Restart app (kill and restart servewallet)
 * - Check that watch-only accounts still show up (with no simulator running)
 */
test('Test #2 - No passphrase - Watch-only account', async ({ page, host, frontendPort, servewalletPort }) => {
    await test.step('Start servewallet', async () => {
        servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, true);
        await servewallet.start();
    });

    await test.step('Start simulator', async () => {
        cleanFakeMemoryFiles();
        const simulatorPath = process.env.SIMULATOR_PATH;
        if (!simulatorPath) {
            throw new Error('SIMULATOR_PATH environment variable not set');
        }

        simulatorProc = startSimulator(simulatorPath, true);

        console.log('Simulator started');
    });

    await test.step('Initialize wallet', async () => {
        await completeWalletSetupFlow(page);
    });

    await test.step('Check that three accounts show up', async () => {
        await assertFieldsCount(page, 'data-label', 'Account name', 3);
    });

    await test.step('Enable watch-only account', async () => {
        await page.getByRole('link', { name: 'Settings' }).click();
        await page.getByRole('link', { name: 'Manage accounts' }).click();
        await page.locator('label').filter({ hasText: 'Remember wallet' }).locator('label span').click();
        await clickButtonWithText(page, 'OK');
    });

    await test.step('Kill simulator', async () => {
        simulatorProc?.kill('SIGTERM');
        simulatorProc = undefined;
    });

    await test.step('Check that watch-only accounts shows up', async () => {
        await page.getByRole('link', { name: 'My portfolio' }).click();
        await assertFieldsCount(page, 'data-label', 'Account name', 3);
    });


    await test.step('Restart servewallet', async () => {
        await servewallet.restart();
    });

    await test.step('Check that accounts still show up', async () => {
        await assertFieldsCount(page, 'data-label', 'Account name', 3);
    });
});

function deleteAccountsFile() {
    const filePath = path.join(process.cwd(), '../../appfolder.dev/accounts.json');
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    } else {
        console.warn(`File ${filePath} does not exist, skipping removal.`);
    }
}

// Ensure a clean state before running all tests.
test.beforeAll(() => {
    deleteAccountsFile()
    cleanFakeMemoryFiles();
});

// Kill the simulator and stop the servewallet after each run.
// This is equivalent to closing the app and unplugging the device.
test.afterEach(() => {
    if (simulatorProc) {
        simulatorProc.kill('SIGTERM');
        simulatorProc = undefined;
    }
    servewallet.stop();
});
