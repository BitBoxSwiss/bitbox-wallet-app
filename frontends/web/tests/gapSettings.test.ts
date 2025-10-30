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
import { clickButtonWithText } from './helpers/dom';
import { deleteAccountsFile } from './helpers/fs';

let servewallet: ServeWallet;

test('Gap limits are correctly saved', async ({ page, host, frontendPort, servewalletPort }) => {

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host);
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
