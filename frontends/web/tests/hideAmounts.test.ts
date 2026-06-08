// SPDX-License-Identifier: Apache-2.0

import { expect } from '@playwright/test';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { startSimulator, stopSimulator, completeWalletSetupFlow, cleanFakeMemoryFiles } from './helpers/simulator';
import { assertFieldsCount } from './helpers/dom';
import { ChildProcess } from 'child_process';

let servewallet: ServeWallet | undefined;
let simulatorProc: ChildProcess | undefined;

const getSimulatorPath = (): string => {
  const simulatorPath = process.env.SIMULATOR_PATH;
  if (!simulatorPath) {
    throw new Error('SIMULATOR_PATH environment variable not set');
  }
  return simulatorPath;
};

test('Unit prices remain visible when amounts are hidden', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    simulatorProc = startSimulator(getSimulatorPath(), testInfo.outputDir, true);
  });

  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  await test.step('Wait for accounts to load', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });

  await test.step('Navigate to account summary and wait for unit prices', async () => {
    await page.goto('/#/account-summary');
    const unitPrices = page.locator('[data-testid="unit-price-amount"]');
    await expect(unitPrices.first()).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => {
        const texts = await unitPrices.allTextContents();
        return texts.some(text => text.trim().length > 0 && !text.includes('---'));
      },
      { timeout: 30000 },
    ).toBeTruthy();
  });

  await test.step('Toggle hide amounts', async () => {
    await page.getByRole('button', { name: /Hide amounts/i }).click();
  });

  await test.step('Verify fiat balances are hidden', async () => {
    const fiatBalances = page.locator('[data-testid="fiat-balance"]');
    await expect(fiatBalances.first()).toBeVisible();
    const texts = await fiatBalances.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).toContain('***');
    }
  });

  await test.step('Verify unit prices are still visible', async () => {
    const unitPrices = page.locator('[data-testid="unit-price-amount"]');
    const texts = await unitPrices.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).not.toContain('***');
    }
  });
});

test.beforeEach(() => {
  deleteAccountsFile();
  deleteConfigFile();
  cleanFakeMemoryFiles();
});

test.afterEach(async () => {
  if (simulatorProc) {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  }
  await servewallet?.stop();
  servewallet = undefined;
  deleteConfigFile();
  deleteAccountsFile();
  cleanFakeMemoryFiles();
});
