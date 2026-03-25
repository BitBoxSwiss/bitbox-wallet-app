// SPDX-License-Identifier: Apache-2.0

import { expect, type Page } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { test } from './helpers/fixtures';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { ServeWallet } from './helpers/servewallet';
import { cleanFakeMemoryFiles, completeWalletSetupFlow, startSimulator } from './helpers/simulator';

let servewallet: ServeWallet | undefined;
let simulatorProc: ChildProcess | undefined;

const startSwapApp = async (
  page: Page,
  host: string,
  frontendPort: number,
  servewalletPort: number,
  testName: string,
) => {
  servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testName, { simulator: true });
  await servewallet.start();

  const simulatorPath = process.env.SIMULATOR_PATH;
  if (!simulatorPath) {
    throw new Error('SIMULATOR_PATH environment variable not set');
  }

  simulatorProc = startSimulator(simulatorPath, testName, true);
  await completeWalletSetupFlow(page);
  await expect(page.locator('body')).toContainText('My portfolio');
};

const openSellAccountOptions = async (page: Page) => {
  await page.getByTestId('swap-sell-account').locator('.react-select__control').click();
};

const openBuyAccountOptions = async (page: Page) => {
  await page.getByTestId('swap-buy-account').locator('.react-select__control').click();
};

test('Swap defaults to ethereum to bitcoin and disables same-coin selections', async ({
  page,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  await test.step('Start app with simulator wallet', async () => {
    await startSwapApp(page, host, frontendPort, servewalletPort, testInfo.title);
  });

  await test.step('Open swap page and verify default pair', async () => {
    await page.goto(`http://${host}:${frontendPort}/#/market/swap`);
    await expect(page.getByTestId('swap-sell-account')).toContainText(/Ethereum/i);
    await expect(page.getByTestId('swap-buy-account')).toContainText(/Bitcoin/i);
  });

  await test.step('Disable bitcoin in the sell selector when bitcoin is selected as buy', async () => {
    await openSellAccountOptions(page);
    const bitcoinOption = page.locator('.react-select__option').filter({ hasText: /Bitcoin/i }).first();
    await expect(bitcoinOption).toHaveClass(/react-select__option--is-disabled/);
    await page.keyboard.press('Escape');
  });

  await test.step('Disable ethereum in the buy selector when ethereum is selected as sell', async () => {
    await openBuyAccountOptions(page);
    const ethereumOption = page.locator('.react-select__option').filter({ hasText: /Ethereum/i }).first();
    await expect(ethereumOption).toHaveClass(/react-select__option--is-disabled/);
    await page.keyboard.press('Escape');
  });
});

test('Swap flip swaps accounts and restores the original amounts when flipped back', async ({
  page,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  await test.step('Mock swap quotes', async () => {
    await page.route('**/api/swap/quote', async route => {
      const requestData = route.request().postDataJSON() as {
        buyCoinCode: string;
        sellAmount: string;
        sellCoinCode: string;
      };

      if (requestData.sellCoinCode === 'sepeth' && requestData.buyCoinCode === 'tbtc' && requestData.sellAmount === '1') {
        await route.fulfill({
          json: {
            success: true,
            quote: {
              routes: [{ routeId: 'eth-to-btc', expectedBuyAmount: '30' }],
            },
          },
        });
        return;
      }

      if (requestData.sellCoinCode === 'tbtc' && requestData.buyCoinCode === 'sepeth' && requestData.sellAmount === '30') {
        await route.fulfill({
          json: {
            success: true,
            quote: {
              routes: [{ routeId: 'btc-to-eth', expectedBuyAmount: '0.98' }],
            },
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          success: false,
          errorCode: 'noRoute',
          errorMessage: `Unexpected test quote request: ${JSON.stringify(requestData)}`,
        },
      });
    });
  });

  await test.step('Start app with simulator wallet', async () => {
    await startSwapApp(page, host, frontendPort, servewalletPort, testInfo.title);
  });

  await test.step('Open swap page and fetch the initial quote', async () => {
    await page.goto(`http://${host}:${frontendPort}/#/market/swap`);
    await page.locator('#swapSendAmount').fill('1');
    await expect(page.locator('#swapGetAmount')).toHaveValue('30');
  });

  await test.step('Flip the pair and update to the reversed quote', async () => {
    await page.getByTestId('swap-flip-button').click();
    await expect(page.locator('#swapSendAmount')).toHaveValue('30');
    await expect(page.locator('#swapGetAmount')).toHaveValue('0.98');
  });

  await test.step('Flip back and restore the original pair amounts', async () => {
    await page.getByTestId('swap-flip-button').click();
    await expect(page.locator('#swapSendAmount')).toHaveValue('1');
    await expect(page.locator('#swapGetAmount')).toHaveValue('30');
  });
});

test.beforeAll(() => {
  deleteAccountsFile();
  deleteConfigFile();
  cleanFakeMemoryFiles();
});

test.afterEach(async () => {
  if (simulatorProc) {
    simulatorProc.kill('SIGTERM');
    simulatorProc = undefined;
  }
  await servewallet?.stop();
  servewallet = undefined;
  deleteAccountsFile();
  deleteConfigFile();
  cleanFakeMemoryFiles();
});
