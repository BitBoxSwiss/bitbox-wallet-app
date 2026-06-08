// SPDX-License-Identifier: Apache-2.0

import { expect, Locator, Page } from '@playwright/test';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { startSimulator, stopSimulator, completeWalletSetupFlow, cleanFakeMemoryFiles } from './helpers/simulator';
import { assertFieldsCount, clickButtonWithText } from './helpers/dom';
import { ChildProcess } from 'child_process';

let servewallet: ServeWallet | undefined;
let simulatorProc : ChildProcess | undefined;

const INITIAL_WALLET_NAME = 'Initial';
const FIRST_RENAMED_WALLET_NAME = 'Middle';
const SECOND_INITIAL_WALLET_NAME = 'Alpha';
const SECOND_RENAMED_WALLET_NAME = 'Zulu';

const getSimulatorPath = (): string => {
  const simulatorPath = process.env.SIMULATOR_PATH;
  if (!simulatorPath) {
    throw new Error('SIMULATOR_PATH environment variable not set');
  }
  return simulatorPath;
};

const startTestSimulator = (outputDir: string, useFakeMemory = false) => {
  simulatorProc = startSimulator(getSimulatorPath(), outputDir, useFakeMemory);
};

const getTexts = async (locator: Locator): Promise<string[]> => {
  return locator.evaluateAll(elements => elements
    .map(element => element.textContent?.trim() ?? '')
    .filter(Boolean));
};

const expectTextsInOrder = async (locator: Locator, expected: string[]) => {
  await expect.poll(async () => getTexts(locator)).toEqual(expected);
};

const assertSidebarKeystoreOrder = async (page: Page, expected: string[]) => {
  await expectTextsInOrder(
    page.locator('[data-testid="sidebar-keystores"] [data-testid="keystore-name"]'),
    expected,
  );
};

const assertSidebarKeystoreConnectionStates = async (page: Page, expected: string[]) => {
  await expect.poll(async () => page
    .locator('[data-testid="sidebar-keystores"] [data-testid="connected-keystore"]')
    .evaluateAll(elements => elements
      .map(element => element.getAttribute('data-connected') ?? '')
      .filter(Boolean))).toEqual(expected);
};

const assertAccountSummaryKeystoreOrder = async (page: Page, expected: string[]) => {
  await page.goto('/#/account-summary');
  await expectTextsInOrder(
    page.locator('[data-testid="account-summary-keystores"] [data-testid="keystore-name"]'),
    expected,
  );
};

const assertManageAccountsKeystoreOrder = async (page: Page, expected: string[]) => {
  await page.goto('/#/settings/manage-accounts');
  await expectTextsInOrder(
    page.locator('[data-testid="manage-accounts-keystores"] [data-testid="keystore-name"]'),
    expected,
  );
};

const assertReceiveSelectorKeystoreOrder = async (page: Page, expected: string[]) => {
  await page.goto('/#/accounts/select-receive');
  const accountSelector = page.locator('.react-select__control');
  await accountSelector.waitFor({ state: 'visible' });
  await accountSelector.click();
  await expectTextsInOrder(
    page.locator('[data-testid="grouped-account-selector-group-label"]'),
    expected,
  );
  await page.keyboard.press('Escape');
};

const assertAllAccountsKeystoreOrder = async (
  page: Page,
  expected: string[],
  desktopViewport: {
    width: number;
    height: number;
  },
) => {
  await page.setViewportSize({ width: 600, height: 1200 });
  await page.goto('/#/accounts/all');
  await expectTextsInOrder(
    page.locator('[data-testid="all-accounts-keystores"] [data-testid="keystore-name"]'),
    expected,
  );
  await page.setViewportSize(desktopViewport);
};

const assertKeystoreOrderAcrossRelevantPages = async (
  page: Page,
  expected: string[],
  desktopViewport: {
    width: number;
    height: number;
  },
) => {
  await page.setViewportSize(desktopViewport);
  await assertSidebarKeystoreOrder(page, expected);
  await assertAccountSummaryKeystoreOrder(page, expected);
  await assertManageAccountsKeystoreOrder(page, expected);
  await assertReceiveSelectorKeystoreOrder(page, expected);
  await assertAllAccountsKeystoreOrder(page, expected, desktopViewport);
};

const renameConnectedDevice = async (page: Page, newName: string, expectedSidebarOrder: string[]) => {
  await page.goto('/#/settings/general');
  await page.getByRole('link', { name: 'Device' }).click();
  await page.locator('button').filter({ hasText: 'BitBox name' }).click();
  await page.locator('#deviceName').fill(newName);
  await clickButtonWithText(page, 'OK');
  await assertSidebarKeystoreOrder(page, expectedSidebarOrder);
};

/**
 * Test scenario 1:
 * - Unlock BB02 with no passphrase.
 * - Wait for accounts to load
 * - Disconnect BB02 (kill the simulator)
 * - Check that accounts disappear
 * - Restart app (kill and restart servewallet)
 * - Check that accounts do not show up without simulator running.
 */
test('Test #1 - No passphrase and no watch-only', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {
  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    startTestSimulator(testInfo.outputDir, true);
  });

  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  await test.step('Check that three accounts show up', async () => {
    // Wait for the three accounts to show up
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });

  await test.step('Kill simulator', async () => {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  });

  await test.step('Check that accounts disappear', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 0);
  });

  await test.step('Restart servewallet', async () => {
    await servewallet!.restart();
  });

  await test.step('Check that accounts do not show up without simulator', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 0);
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
test('Test #2 - No passphrase - Watch-only account', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {
  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    cleanFakeMemoryFiles();
    startTestSimulator(testInfo.outputDir, true);
  });

  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  await test.step('Check that three accounts show up', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });

  await test.step('Enable watch-only account', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Manage accounts' }).click();
    await page.locator('label').filter({ hasText: 'Remember wallet' }).locator('label span').click();
    await clickButtonWithText(page, 'OK');
  });

  await test.step('Kill simulator', async () => {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  });

  await test.step('Check that watch-only accounts shows up', async () => {
    await page.getByRole('link', { name: 'My portfolio' }).click();
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });


  await test.step('Restart servewallet', async () => {
    await servewallet!.restart();
  });

  await test.step('Check that accounts still show up', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });
});

/**
 * Test scenario 3:
 * - Unlock BB02 with no passphrase.
 * - Wait for accounts to load
 * - Enable "Remember wallet" (watch-only)
 * - Disconnect BB02 (kill the simulator)
 * - Go to Manage accounts -> Add account
 * - Check that the user is prompted to connect a keystore
 */
test('Test #3 - Watch-only add account prompts for keystore', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {
  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    cleanFakeMemoryFiles();
    startTestSimulator(testInfo.outputDir, true);
  });

  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  await test.step('Enable watch-only account', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Manage accounts' }).click();
    await page.locator('label').filter({ hasText: 'Remember wallet' }).locator('label span').click();
    await clickButtonWithText(page, 'OK');
  });

  await test.step('Kill simulator', async () => {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  });

  await test.step('Navigate to add account and prompt for keystore', async () => {
    await page.getByRole('button', { name: 'Add account' }).click();
    await expect(page.getByText('Please connect your BitBox to continue')).toBeVisible();
  });

  await test.step('Reconnect keystore and add an account', async () => {
    startTestSimulator(testInfo.outputDir, true);

    const dropdown = page.locator('.react-select__control');
    const nameInput = page.locator('#accountName');
    await Promise.race([
      dropdown.waitFor({ state: 'visible' }),
      nameInput.waitFor({ state: 'visible' }),
    ]);

    if (await dropdown.isVisible()) {
      await dropdown.click();
      await page.locator('.react-select__option:not(.react-select__option--is-disabled)').first().click();
      await page.getByRole('button', { name: 'Next' }).click();
      await nameInput.waitFor({ state: 'visible' });
    }

    await nameInput.fill('Test account');
    await page.getByRole('button', { name: 'Add account' }).click();
    await expect(page.getByText('has now been added to your accounts.')).toBeVisible();
  });
});

test('Test #4 - Keystore rename updates and reorders watch-only wallets', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {
  const desktopViewport = page.viewportSize() ?? { width: 1280, height: 720 };

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start first simulator with fresh fake memory', async () => {
    cleanFakeMemoryFiles();
    startTestSimulator(testInfo.outputDir, true);
  });

  await test.step('Initialize first wallet', async () => {
    await completeWalletSetupFlow(page, INITIAL_WALLET_NAME);
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
    await assertSidebarKeystoreOrder(page, [INITIAL_WALLET_NAME]);
  });

  await test.step('Rename first wallet and update the sidebar', async () => {
    await renameConnectedDevice(page, FIRST_RENAMED_WALLET_NAME, [FIRST_RENAMED_WALLET_NAME]);
    await expect(page.locator('[data-testid="sidebar-keystores"]')).not.toContainText(INITIAL_WALLET_NAME);
  });

  await test.step('Enable watch-only for the first wallet', async () => {
    await page.goto('/#/settings/manage-accounts');
    await page.locator('label').filter({ hasText: 'Remember wallet' }).locator('label span').click();
    await clickButtonWithText(page, 'OK');
  });

  await test.step('Unplug the first simulator and keep the wallet visible as watch-only', async () => {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
    await page.goto('/#/account-summary');
    await assertSidebarKeystoreConnectionStates(page, ['false']);
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
    await assertSidebarKeystoreOrder(page, [FIRST_RENAMED_WALLET_NAME]);
  });

  await test.step('Start a fresh simulator without fake memory and initialize a wallet that sorts before the first', async () => {
    startTestSimulator(testInfo.outputDir);
    await completeWalletSetupFlow(page, SECOND_INITIAL_WALLET_NAME);
    await assertFieldsCount(page, 'data-testid', 'account-name', 6);
  });

  await test.step('Verify the new wallet is sorted before the watch-only wallet everywhere relevant', async () => {
    await assertKeystoreOrderAcrossRelevantPages(
      page,
      [SECOND_INITIAL_WALLET_NAME, FIRST_RENAMED_WALLET_NAME],
      desktopViewport,
    );
  });

  await test.step('Rename the connected wallet so it sorts below the watch-only wallet', async () => {
    await renameConnectedDevice(
      page,
      SECOND_RENAMED_WALLET_NAME,
      [FIRST_RENAMED_WALLET_NAME, SECOND_RENAMED_WALLET_NAME],
    );
    await expect(page.locator('[data-testid="sidebar-keystores"]')).not.toContainText(SECOND_INITIAL_WALLET_NAME);
  });

  await test.step('Verify the reordered wallet list everywhere relevant', async () => {
    await assertKeystoreOrderAcrossRelevantPages(
      page,
      [FIRST_RENAMED_WALLET_NAME, SECOND_RENAMED_WALLET_NAME],
      desktopViewport,
    );
  });
});


// Ensure a clean state before each test, as these scenarios intentionally mutate persisted
// watch-only and frontend config state.
test.beforeEach(() => {
  deleteAccountsFile();
  deleteConfigFile();
  cleanFakeMemoryFiles();
});

// Kill the simulator and stop the servewallet after each run.
// This is equivalent to closing the app and unplugging the device.
test.afterEach(async () => {
  if (simulatorProc) {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  }
  await servewallet?.stop();
  servewallet = undefined;
});
