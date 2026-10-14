// SPDX-License-Identifier: Apache-2.0

import { expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ChildProcess } from 'child_process';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { launchRegtest, setupRegtestWallet, sendCoins, mineBlocks, cleanupRegtest } from './helpers/regtest';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { getReceiveAddressData } from './helpers/account';

type AccountsConfig = {
  keystores?: Array<Record<string, unknown>>;
};

const ACCOUNTS_PATH = path.join(process.cwd(), '../../appfolder.dev/accounts.json');
const BANNER_REGEX = /Your wallet\s+Software keystore [a-f0-9]+\s+passed/;
const BANNER_RECOMMENDATION = 'We recommend creating a paper backup for extra protection.';

let servewallet: ServeWallet | undefined;
let regtest: ChildProcess | undefined;

const readAccountsConfig = (): AccountsConfig => {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error(`Missing accounts config at ${ACCOUNTS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) as AccountsConfig;
};

const writeAccountsConfig = (config: AccountsConfig) => {
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(config, null, 4));
};

const setBackupReminderAllowed = (value: boolean) => {
  const config = readAccountsConfig();
  const keystores = config.keystores;
  if (!Array.isArray(keystores) || keystores.length === 0) {
    throw new Error('No keystores found in accounts config');
  }
  for (const keystore of keystores) {
    (keystore as { backupReminderAllowed?: boolean }).backupReminderAllowed = value;
  }
  writeAccountsConfig(config);
};

const clearBackupReminderAllowed = () => {
  const config = readAccountsConfig();
  const keystores = config.keystores;
  if (!Array.isArray(keystores) || keystores.length === 0) {
    throw new Error('No keystores found in accounts config');
  }
  for (const keystore of keystores) {
    delete (keystore as { backupReminderAllowed?: boolean }).backupReminderAllowed;
  }
  writeAccountsConfig(config);
};

const getBackupReminderAllowed = (): boolean | undefined => {
  const config = readAccountsConfig();
  const keystores = config.keystores;
  if (!Array.isArray(keystores) || keystores.length === 0) {
    return undefined;
  }
  return (keystores[0] as { backupReminderAllowed?: boolean }).backupReminderAllowed;
};

const unlockWallet = async (page: Page) => {
  await page.getByRole('button', { name: 'Test wallet' }).click();
  await page.getByRole('button', { name: 'Unlock' }).click();
};

const unlockWalletAndGetReceiveAddress = async (
  page: Page,
  host: string,
  servewalletPort: number,
): Promise<string> => {
  await unlockWallet(page);
  await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
  await page.getByRole('button', { name: 'Receive Bitcoin' }).click();
  await page.getByRole('button', { name: 'Verify address on BitBox' }).click();
  const addressLocator = page.locator('[data-testid="receive-address"]');
  const receiveAddress = await getReceiveAddressData(page, host, servewalletPort);
  await expect(addressLocator).toHaveValue(receiveAddress.displayAddress);
  return receiveAddress.address;
};

const fundAddress = async (address: string) => {
  await sendCoins(address, '10');
  await mineBlocks(12);
};

const verifyBackupBannerHidden = async (page: Page) => {
  await expect(page.getByTestId('fiat-balance')).toContainText(/500['\u2019,.\s]000[.,]00 USD/);

  // Reload after balances load so the banner decision uses the funded wallet.
  const bannerRequest = page.waitForRequest('**/api/keystore/show-backup-banner/*');
  await page.reload();
  const response = await (await bannerRequest).response();
  expect(response?.ok()).toBe(true);
  const banner = await response?.json();
  expect(banner).toMatchObject({ success: true });
  // The backend omits show when it is false.
  expect(banner.show).toBeFalsy();

  await expect(page.locator('body')).not.toContainText(BANNER_REGEX);
  await expect(page.locator('body')).not.toContainText(BANNER_RECOMMENDATION);
};

const verifyBackupBannerShown = async (page: Page) => {
  await expect(page.locator('body')).toContainText(BANNER_REGEX);
  await expect(page.locator('body')).toContainText(BANNER_RECOMMENDATION);
};

test.beforeEach(() => {
  deleteAccountsFile();
  deleteConfigFile();
});

test.afterEach(async () => {
  if (servewallet) {
    await servewallet.stop();
    servewallet = undefined;
  }
  await cleanupRegtest(regtest);
  regtest = undefined;
});

// An explicitly suppressed wallet stays hidden even when its funded balance exceeds the threshold.
test('Backup reminder stays hidden when allowed is false', async ({ page, host, frontendPort, servewalletPort, ratesURL }, testInfo) => {
  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await setupRegtestWallet();
  });

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { regtest: true, testnet: false });
    await servewallet.start({ extraFlags: { coingeckoURL: ratesURL } });
  });

  const recvAddress = await test.step('Grab receive address', async () => {
    return unlockWalletAndGetReceiveAddress(page, host, servewalletPort);
  });

  await test.step('Stop servewallet', async () => {
    await servewallet?.stop();
  });

  await test.step('Force backup reminder allowed=false', async () => {
    setBackupReminderAllowed(false);
  });

  await test.step('Fund wallet while app is stopped', async () => {
    await fundAddress(recvAddress);
  });

  await test.step('Restart servewallet', async () => {
    await servewallet?.start({ extraFlags: { coingeckoURL: ratesURL } });
  });

  await test.step('Unlock wallet after restart', async () => {
    await unlockWallet(page);
  });

  await test.step('Verify banner stays hidden', async () => {
    await page.goto('/');
    await verifyBackupBannerHidden(page);
  });
});

// First observing a funded wallet above the fixed fiat threshold permanently suppresses its reminder.
test('Backup reminder stays suppressed when first seen over threshold', async ({ page, host, frontendPort, servewalletPort, ratesURL }, testInfo) => {
  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await setupRegtestWallet();
  });

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { regtest: true, testnet: false });
    await servewallet.start({ extraFlags: { coingeckoURL: ratesURL } });
  });

  const recvAddress = await test.step('Grab receive address', async () => {
    return unlockWalletAndGetReceiveAddress(page, host, servewalletPort);
  });

  await test.step('Stop servewallet', async () => {
    await servewallet?.stop();
  });

  await test.step('Fund wallet while app is stopped', async () => {
    await fundAddress(recvAddress);
  });

  await test.step('Clear backup reminder allowed flag', async () => {
    clearBackupReminderAllowed();
  });

  await test.step('Restart servewallet', async () => {
    await servewallet?.start({ extraFlags: { coingeckoURL: ratesURL } });
  });

  await test.step('Unlock wallet after restart', async () => {
    await unlockWallet(page);
  });

  await test.step('Verify banner stays hidden and flag is set false', async () => {
    await page.goto('/');
    await expect.poll(() => getBackupReminderAllowed(), { timeout: 5000 }).toBe(false);
    await verifyBackupBannerHidden(page);
  });
});

// Observe the empty wallet below the threshold before funding, then show its reminder using fixed rates.
test('Backup reminder shows after funding a new wallet', async ({ page, host, frontendPort, servewalletPort, ratesURL }, testInfo) => {
  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await setupRegtestWallet();
  });

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { regtest: true, testnet: false });
    await servewallet.start({ extraFlags: { coingeckoURL: ratesURL } });
  });

  const recvAddress = await test.step('Grab receive address', async () => {
    return unlockWalletAndGetReceiveAddress(page, host, servewalletPort);
  });

  await test.step('Fund wallet', async () => {
    await expect.poll(() => getBackupReminderAllowed(), { timeout: 5000 }).toBe(true);
    await fundAddress(recvAddress);
  });

  await test.step('Verify banner is shown', async () => {
    await page.goto('/');
    await verifyBackupBannerShown(page);
  });
});
