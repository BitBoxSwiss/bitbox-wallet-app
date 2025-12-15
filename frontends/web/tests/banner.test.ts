// SPDX-License-Identifier: Apache-2.0

import { expect, Page } from '@playwright/test';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { launchRegtest, setupRegtestWallet, sendCoins, mineBlocks, cleanupRegtest } from './helpers/regtest';
import { ChildProcess } from 'child_process';

let servewallet: ServeWallet;
let regtest: ChildProcess;

test('Backup reminder banner is shown when currency is > 1000', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {


  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    // Give regtest some time to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await setupRegtestWallet();
  });


  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name, { regtest: true, testnet: false });
    await servewallet.start();
  });

  let recvAdd: string;
  await test.step('Grab receive address', async () => {
    await page.getByRole('button', { name: 'Test wallet' }).click();
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    await page.getByRole('button', { name: 'Receive RBTC' }).click();
    await page.getByRole('button', { name: 'Verify address on BitBox' }).click();
    const addressLocator = page.locator('[data-testid="receive-address"]');
    recvAdd = await addressLocator.inputValue();
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Verify that the backup banner is NOT shown initially', async () => {
    await page.goto('/');
    await verifyBackupBanner(page, undefined, false);
  });

  await test.step('Send RBTC to receive address', async () => {
    await page.waitForTimeout(2000);
    const sendAmount = '10';
    sendCoins(recvAdd, sendAmount);
    mineBlocks(12);
  });

  await test.step('Verify that the backup banner is shown with the correct currency', async () => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    const units = ['USD', 'EUR', 'CHF'];
    let currentIndex = 0;
    // First, verify that the banner shows USD by default.
    await verifyBackupBanner(page, units[currentIndex]!);

    // Then, cycle through the currency units and verify the banner updates accordingly.
    for (let i = 0; i < units.length; i++) {
      await page.locator(`header [data-testid="amount-unit-${units[currentIndex]!}"]`).click();
      const nextIndex = (currentIndex + 1) % units.length;
      await page.waitForTimeout(1000); // wait for the UI to update
      await verifyBackupBanner(page, units[nextIndex]!);
      currentIndex = nextIndex;
    }
  });
});

// Helper function to verify the banner presence or absence
async function verifyBackupBanner(
  page: Page,
  expectedCurrency?: string,
  shouldExist = true
) {
  await test.step(
    shouldExist
      ? `Verify that the backup banner is shown for ${expectedCurrency!}`
      : 'Verify that the backup banner is NOT shown',
    async () => {
      const textContent = await page.textContent('body');

      if (shouldExist) {
        if (!expectedCurrency) {
          throw new Error('Currency must be provided when expecting banner.');
        }

        const regex = new RegExp(
          `Your wallet\\s+Software keystore [a-f0-9]+\\s+passed ${expectedCurrency} 1[’,']000\\.00!`
        );
        expect(textContent).toMatch(regex);

        expect(textContent).toContain(
          'We recommend creating a paper backup for extra protection. It\'s quick and simple.'
        );
      } else {
        // Check that the banner text is NOT present
        const bannerRegex = /Your wallet Software keystore [a-f0-9]+ passed [A-Z]{3} 1,000\.00!/;
        expect(textContent).not.toMatch(bannerRegex);
        expect(textContent).not.toContain(
          'We recommend creating a paper backup for extra protection. It\'s quick and simple.'
        );
      }
    }
  );
}

test.afterAll(async () => {
  await servewallet.stop();
  await cleanupRegtest(regtest);
});
