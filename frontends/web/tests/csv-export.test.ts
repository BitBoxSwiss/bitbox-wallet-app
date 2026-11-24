// SPDX-License-Identifier: Apache-2.0

import { expect } from '@playwright/test';
import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { test } from './helpers/fixtures';
import { deleteAccountsFile } from './helpers/fs';
import { getAccountCodeFromUrl, getReceiveAddress, waitForAccountTransactions } from './helpers/account';
import { cleanupRegtest, launchRegtest, mineBlocks, sendCoins, setupRegtestWallet } from './helpers/regtest';
import { ServeWallet } from './helpers/servewallet';

let servewallet: ServeWallet | undefined;
let regtest: ChildProcess | undefined;

test('Export account transactions as CSV', async ({
  page,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  const exportHome = path.join(testInfo.outputDir, 'home');
  const exportDir = path.join(exportHome, 'Downloads');
  fs.mkdirSync(exportDir, { recursive: true });

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
    await servewallet.start({
      env: {
        HOME: exportHome,
        GOCACHE: process.env.GOCACHE || path.join(os.tmpdir(), 'bitbox-wallet-app-go-build-cache'),
      },
    });
  });

  let accountCode: string;
  let receiveAddress: string;
  let transactionID: string;

  await test.step('Fund test account', async () => {
    await page.getByRole('button', { name: 'Test wallet' }).click();
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    accountCode = getAccountCodeFromUrl(page.url());

    await page.getByRole('button', { name: 'Receive Bitcoin' }).click();
    receiveAddress = await getReceiveAddress(page, host, servewalletPort);
    transactionID = await sendCoins(receiveAddress, 1);
    await mineBlocks(12);
    await waitForAccountTransactions(page, host, servewalletPort, accountCode, 1);
  });

  await test.step('Export transactions from account info', async () => {
    await page.goto(`/#/account/${accountCode}/info`);
    const exportButton = page.getByRole('button', { name: 'Export transaction history' });
    await expect(exportButton).toBeEnabled();

    const exportResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/account/${accountCode}/export`)
      && response.request().method() === 'POST'
    );
    await exportButton.click();
    const exportResponse = await exportResponsePromise;

    expect(exportResponse.ok()).toBe(true);
    await expect(exportResponse.json()).resolves.toMatchObject({ success: true });
  });

  await test.step('Verify exported CSV', async () => {
    const exportedFiles = fs.readdirSync(exportDir)
      .filter(filename => filename.endsWith(`-${accountCode}-export.csv`));
    expect(exportedFiles).toHaveLength(1);
    const exportedFilename = exportedFiles[0];
    if (!exportedFilename) {
      throw new Error('Expected one exported CSV file');
    }

    const exportedPath = path.join(exportDir, exportedFilename);
    const csv = fs.readFileSync(exportedPath, 'utf8');
    const lines = csv.trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'Time,Type,Amount,Unit,Fee,Fee Unit,Address,Transaction ID,Historical value,Historical value currency,Note'
    );

    const fields = lines[1]?.split(',') ?? [];
    expect(fields).toHaveLength(11);
    const [timestamp, ...transactionFields] = fields;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(transactionFields).toEqual([
      'received',
      '100000000',
      'satoshi',
      '',
      '',
      receiveAddress,
      transactionID,
      '',
      '',
      '',
    ]);
    expect(fs.statSync(exportedPath).mode & 0o777).toBe(0o600);
  });
});

test.beforeEach(() => {
  deleteAccountsFile();
});

test.afterAll(async () => {
  await servewallet?.stop();
  await cleanupRegtest(regtest);
});
