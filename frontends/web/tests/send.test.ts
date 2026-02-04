// SPDX-License-Identifier: Apache-2.0

import { expect } from '@playwright/test';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { launchRegtest, setupRegtestWallet, sendCoins, mineBlocks, cleanupRegtest } from './helpers/regtest';
import { ChildProcess } from 'child_process';
import { deleteAccountsFile } from './helpers/fs';

let servewallet: ServeWallet;
let regtest: ChildProcess;

test('Send BTC', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {

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
    await expect(addressLocator).toHaveValue(/bcrt1/);
    recvAdd = await addressLocator.inputValue();
    expect(recvAdd).toContain('bcrt1');
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Verify there are no transactions yet', async () => {
    await page.goto('/#/account-summary');
    await mineBlocks(12);
    await page.locator('[data-label="Account name"]').nth(0).click();
    await expect(page.getByTestId('transaction')).toHaveCount(0);
  });

  await test.step('Add second RBTC account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Manage Accounts' }).click();
    await page.waitForURL('**/settings/manage-accounts');
    const addAccountButton = page.getByRole('button', { name: 'Add account' });
    await expect(addAccountButton).toBeVisible();
    await addAccountButton.click();
    await addAccountButton.click();
    await expect(page.locator('body')).toContainText('Bitcoin Regtest 2 has now been added to your accounts.');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'Bitcoin Regtest 2' })).toBeVisible();
  });

  await test.step('Send RBTC to receive address', async () => {
    console.log('Sending RBTC to first account');
    await page.waitForTimeout(2000);
    const sendAmount = '10';
    await sendCoins(recvAdd, sendAmount);
    await mineBlocks(12);
  });

  await test.step('Verify that the first account has a transaction', async () => {
    await page.goto('/#/account-summary');
    await page.locator('[data-label="Account name"]').nth(0).click();
    await expect(page.getByTestId('transaction')).toHaveCount(1);

    // It should be an incoming tx
    const tx = page.getByTestId('transaction').nth(0);
    await expect(tx).toHaveAttribute('data-tx-type', 'receive');

  });

  await test.step('Grab receive address for second account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();

    await page.getByRole('button', { name: 'Receive RBTC' }).click();
    await page.waitForURL('**/receive');
    const verifyButton = page.getByRole('button', { name: 'Verify address on BitBox' });
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();
    const addressLocator = page.locator('[data-testid="receive-address"]');
    await expect(addressLocator).toHaveValue(/bcrt1/);
    recvAdd = await addressLocator.inputValue();
    expect(recvAdd).toContain('bcrt1');
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Send RBTC to second account receive address', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    console.log('Sending RBTC to second account');
    await page.getByRole('link', { name: 'Send' }).click();
    await page.waitForURL('**/send');
    await page.fill('#recipientAddress', recvAdd);
    await page.click('#sendAll');
    const reviewButton = page.getByRole('button', { name: 'Review' });
    await expect(reviewButton).toBeEnabled();
    const sendTxResponse = page.waitForResponse((response) =>
      response.url().includes('/sendtx') && response.request().method() === 'POST'
    );
    await reviewButton.click();
    await sendTxResponse;
    const doneButton = page.getByRole('button', { name: 'Done' });
    await expect(doneButton).toBeVisible();
    await doneButton.click();
    await mineBlocks(12);
  });

  await test.step('Verify that first account now has two transactions', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    await expect(page.getByTestId('transaction')).toHaveCount(2);
    // Verify that the second one is outgoing
    // Txs are shown in reverse order
    const oldTx = page.getByTestId('transaction').nth(1);
    await expect(oldTx).toHaveAttribute('data-tx-type', 'receive');

    const newTx = page.getByTestId('transaction').nth(0);
    await expect(newTx).toHaveAttribute('data-tx-type', 'send');
  });

  await test.step('Verify that the second account has a transaction', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();
    await expect(page.getByTestId('transaction')).toHaveCount(1);

    const tx = page.getByTestId('transaction').nth(0);
    await expect(tx).toHaveAttribute('data-tx-type', 'receive');
  });

  await test.step('Grab new receive address for second account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();
    await page.getByRole('link', { name: 'Receive' }).click();
    await page.waitForURL('**/receive');
    const verifyButton = page.getByRole('button', { name: 'Verify address on BitBox' });
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();
    const addressLocator = page.locator('[data-testid="receive-address"]');
    await expect(addressLocator).toHaveValue(/bcrt1/);
    recvAdd = await addressLocator.inputValue();
    expect(recvAdd).toContain('bcrt1');
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Send to self from second account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();
    console.log('Sending RBTC from second account to itself');
    await page.getByRole('link', { name: 'Send' }).click();
    await page.waitForURL('**/send');
    await page.fill('#recipientAddress', recvAdd);
    await page.click('#sendAll');
    const reviewButton = page.getByRole('button', { name: 'Review' });
    await expect(reviewButton).toBeEnabled();
    const sendTxResponse = page.waitForResponse((response) =>
      response.url().includes('/sendtx') && response.request().method() === 'POST'
    );
    await reviewButton.click();
    await sendTxResponse;
    const doneButton = page.getByRole('button', { name: 'Done' });
    await expect(doneButton).toBeVisible();
    await doneButton.click();
    await mineBlocks(12);
  });

  await test.step('Verify that the new transaction shows up, with correct values', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();
    await expect(page.getByTestId('transaction')).toHaveCount(2);

    const newTx = page.getByTestId('transaction').nth(0);
    await expect(newTx).toHaveAttribute('data-tx-type', 'send_to_self');

    // Grab fee and amount from the details.
    await newTx.getByTestId('tx-details-button').click();
    const txDetails = page.getByTestId('tx-details-container');
    await expect(txDetails).toBeVisible();
    const amount = await txDetails.getByTestId('amountBlocks').nth(0).textContent();
    const fee = await txDetails.getByTestId('amountBlocks').nth(1).textContent();

    await page.getByTestId('close-button').click();

    // Verify that the values displayed are correctly
    const labelAmount = await newTx
      .getByTestId('amountBlocks').first()
      .textContent();
    const amountsColumn = newTx.getByTestId('tx-amounts');
    const shownDetractedAmount = await amountsColumn.getByTestId('amountBlocks').nth(0).textContent();

    expect(labelAmount).toBe(amount);
    expect(shownDetractedAmount).toBe(fee);

  });

});

test.beforeEach(async () => {
  deleteAccountsFile();
});

test.afterAll(async () => {
  await servewallet.stop();
  await cleanupRegtest(regtest);
});
