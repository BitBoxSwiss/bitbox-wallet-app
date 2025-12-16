// SPDX-License-Identifier: Apache-2.0

import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { expect } from '@playwright/test';
import { clickButtonWithText } from './helpers/dom';
import { deleteAccountsFile } from './helpers/fs';

let servewallet: ServeWallet;

test('Gap limits are correctly saved', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name);
    await servewallet.start();
  });


  await test.step('Navigate to the app', async () => {
    await page.goto(`http://${host}:${frontendPort}`);
    const body = page.locator('body');
    await expect(body).toContainText('Please connect your BitBox and tap the side to continue.');
  });

  await test.step('Type into gap limit inputs', async () => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Advanced settings' }).click();
    await page.getByRole('button', { name: 'Custom gap limit settings' }).click();

    const recvInput = page.locator('#gapLimitReceive');
    await recvInput.clear();
    await recvInput.click();
    await page.keyboard.press('5');
    await expect(page.locator('label[for="gapLimitReceive"]')).toHaveText(
      'Gap limit for receive addresses:The gap limit must be at least 20.'
    );
    await page.waitForTimeout(1000);
    await expect(recvInput).toBeFocused();
    await page.keyboard.press('0');
    await expect(recvInput).toBeFocused();


    const changeInput = page.locator('#gapLimitChange');
    await changeInput.clear();
    await changeInput.click();
    await page.keyboard.press('1');
    await expect(page.locator('label[for="gapLimitChange"]')).toHaveText(
      'Gap limit for change addresses:The gap limit must be at least 6.'
    );
    await page.waitForTimeout(1000);
    await expect(changeInput).toBeFocused();
    await page.keyboard.press('0');
    await expect(changeInput).toBeFocused();

    await clickButtonWithText(page, 'Confirm');
  });

  await test.step('Verify gap limit inputs are correctly saved', async () => {
    await page.getByRole('button', { name: 'Custom gap limit settings' }).click();
    const recvInput = page.locator('#gapLimitReceive');
    await expect(recvInput).toHaveValue('50');
    const changeInput = page.locator('#gapLimitChange');
    await expect(changeInput).toHaveValue('10');
  });
});

test.beforeEach(() => {
  deleteAccountsFile();
});

test.afterAll(() => {
  servewallet.stop();
});
