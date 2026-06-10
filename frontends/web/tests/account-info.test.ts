// SPDX-License-Identifier: Apache-2.0

import { expect } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { test } from './helpers/fixtures';
import { deleteAccountsFile } from './helpers/fs';
import { getAccountCodeFromUrl } from './helpers/account';
import { cleanupRegtest, launchRegtest, setupRegtestWallet } from './helpers/regtest';
import { ServeWallet } from './helpers/servewallet';

let servewallet: ServeWallet | undefined;
let regtest: ChildProcess | undefined;

test('Account details default to persisted Taproot receive address type', async ({
  page,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  await test.step('Start regtest and servewallet', async () => {
    regtest = await launchRegtest();
    await setupRegtestWallet();

    servewallet = new ServeWallet(
      page,
      servewalletPort,
      frontendPort,
      host,
      testInfo.outputDir,
      { regtest: true, testnet: false }
    );
    await servewallet.start();
  });

  let accountCode: string;

  await test.step('Unlock test wallet and select Taproot receive address type', async () => {
    await page.getByRole('button', { name: 'Test wallet' }).click();
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    accountCode = getAccountCodeFromUrl(page.url());

    await page.getByRole('button', { name: 'Receive Bitcoin' }).click();
    await page.waitForURL('**/receive');
    await page.getByRole('button', { name: 'Change address type' }).click();
    await page.locator('label[for="p2tr"]').click();
    await expect(page.getByLabel('Taproot (newest format)')).toBeChecked();

    const receiveScriptTypeResponse = page.waitForResponse((response) =>
      response.url().includes('/set-account-receive-script-type') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Done' }).click();
    await receiveScriptTypeResponse;
  });

  await test.step('Open account details', async () => {
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForURL(/#\/account\/[^/]+$/);
    await page.getByRole('link', { name: /Account info/i }).click();
    await page.getByRole('button', { name: 'View account details' }).click();
    await page.waitForURL(`**/account/${accountCode!}/info/xpub-detail`);
  });

  await test.step('Verify Taproot account details are shown by default', async () => {
    await expect(page.getByText(/Currently displaying P2TR extended public key/)).toBeVisible();
    await expect(page.getByText('Taproot (bech32m, P2TR)')).toBeVisible();
  });
});

test.beforeEach(async () => {
  deleteAccountsFile();
});

test.afterAll(async () => {
  await servewallet?.stop();
  await cleanupRegtest(regtest);
});
