// SPDX-License-Identifier: Apache-2.0

import { test } from './helpers/fixtures';
import { expect } from '@playwright/test';
import { ServeWallet } from './helpers/servewallet';
import { launchRegtest, setupRegtestWallet, sendCoins, mineBlocks, cleanupRegtest } from './helpers/regtest';
import { startSimulator, stopSimulator, completeWalletSetupFlow, cleanFakeMemoryFiles } from './helpers/simulator';
import { ChildProcess } from 'child_process';
import { startAOPPServer, generateAOPPRequest } from './helpers/aopp';
import { assertFieldsCount } from './helpers/dom';
import { deleteAccountsFile } from './helpers/fs';
import { getAccountCodeFromUrl, getReceiveAddress, getReceiveAddressData, waitForAccountTransactions } from './helpers/account';


let servewallet: ServeWallet | undefined;
let regtest: ChildProcess | undefined;
let aoppServer: ChildProcess | undefined;
let simulatorProc : ChildProcess | undefined;

test('AOPP', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {


  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    await setupRegtestWallet();
  });


  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { regtest: true, testnet: false, simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    const simulatorPath = process.env.SIMULATOR_PATH;
    if (!simulatorPath) {
      throw new Error('SIMULATOR_PATH environment variable not set');
    }

    simulatorProc = startSimulator(simulatorPath, testInfo.outputDir, true);
    console.log('Simulator started');
  });


  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  let recvAdd: string;
  let firstAccountCode: string;
  let secondAccountCode: string;
  await test.step('Grab receive address', async () => {
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    await page.getByRole('button', { name: 'Receive Bitcoin' }).click();
    // The simulator auto-confirms address verification and closes the dialog too fast for UI reads.
    recvAdd = await getReceiveAddress(page, host, servewalletPort);
    firstAccountCode = getAccountCodeFromUrl(page.url());
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Send RBTC to receive address', async () => {
    const sendAmount = '10';
    await sendCoins(recvAdd, sendAmount);
    await mineBlocks(12);
    await waitForAccountTransactions(page, host, servewalletPort, firstAccountCode, 1);
    console.log(`Sent ${sendAmount} RBTC to ${recvAdd}`);
  });


  await test.step('Add second RBTC account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Manage Accounts' }).click();
    await page.getByRole('button', { name: 'Add account' }).click();
    await page.getByRole('button', { name: 'Add account' }).click();
    await expect(page.locator('body')).toContainText('Bitcoin Regtest 2 has now been added to your accounts.');
    await page.getByRole('button', { name: 'Done' }).click();
  });


  await test.step('Grab receive address for second account', async () => {
    await page.goto('/#/account-summary');
    await page.getByRole('link', { name: 'Bitcoin Regtest 2' }).click();

    await page.getByRole('button', { name: 'Receive Bitcoin' }).click();
    // Same workaround here to avoid flaky reads from the auto-closing verify dialog.
    recvAdd = await getReceiveAddress(page, host, servewalletPort);
    secondAccountCode = getAccountCodeFromUrl(page.url());
    expect(recvAdd).toContain('bcrt1');
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Send RBTC to receive address', async () => {
    const sendAmount = '10';
    await sendCoins(recvAdd, sendAmount);
    await mineBlocks(12);
    await waitForAccountTransactions(page, host, servewalletPort, secondAccountCode, 1);
    console.log(`Sent ${sendAmount} RBTC to ${recvAdd}`);
  });

  let aoppRequest: string;
  await test.step('Start AOPP server and generate AOPP request', async () => {
    console.log('Starting AOPP server...');
    aoppServer = await startAOPPServer();
    console.log('AOPP server started.');
    console.log('Generating AOPP request...');
    aoppRequest = await generateAOPPRequest('rbtc');
    console.log(`AOPP Request URI: ${aoppRequest}`);
  });

  await test.step('Kill the simulator', async () => {
    // We kill the simulator so that we can verify that with no BB connected,
    // the app shows "Address request in progress. Please connect your device to continue"
    if (simulatorProc) {
      await stopSimulator(simulatorProc);
      simulatorProc = undefined;
      console.log('Simulator killed.');
    }
  });

  await test.step('Kill servewallet and restart with AOPP request', async () => {
    await servewallet?.stop();
    console.log('Servewallet stopped.');
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { regtest: true, testnet: false, simulator: true });
    await servewallet.start({ extraFlags: { aoppUrl: aoppRequest } });
    console.log('Servewallet restarted with AOPP request.');
  });

  await test.step('Address request in progress', async () => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toContainText('localhost:8888 is requesting a receiving address');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(body).toContainText('Address request in progress. Please connect your device to continue');
  });

  // Restart the simulator to continue the AOPP flow
  await test.step('Restart simulator to continue AOPP flow', async () => {
    const simulatorPath = process.env.SIMULATOR_PATH;
    if (!simulatorPath) {
      throw new Error('SIMULATOR_PATH environment variable not set');
    }

    simulatorProc = startSimulator(simulatorPath, testInfo.outputDir, true);
    console.log('Simulator restarted.');
  });

  let aoppAddress : string | null;
  await test.step('Verify AOPP flow is in progress', async () => {
    await page.goto('/');
    const body = page.locator('body');

    // Verify that we can select one of two accounts
    await assertFieldsCount(page, 'id', 'account', 1);
    const options = page.locator('select[id="account"] option');
    await expect(options).toHaveCount(2);

    // Select the first account.
    await page.selectOption('#account', { index: 0 });

    await page.getByRole('button', { name: 'Next' }).click();

    // The simulator automatically accepts and signs the message request,
    // so we should see the success message immediately.
    await expect(body).toContainText('Address successfully sent');
    await expect(body).toContainText('Proceed on localhost:8888');

    const address = page.locator('[data-testid="aopp-address"]');
    aoppAddress = await address.textContent();

    const message = page.locator('[data-testid="aopp-message"]');
    const messageValue = await message.textContent();
    expect(messageValue).toContain('I confirm that I solely control this address.'); //TODO extract ID
    await page.getByRole('button', { name: 'Done' }).click();
  });


  await test.step('Compare receive address with aopp address', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    const receiveButton = page.locator('[data-testid="receive-button"]');
    await receiveButton.click();
    // Use API-derived address so the simulator confirm doesn't race the UI dialog.
    const receiveAddress = await getReceiveAddressData(page, host, servewalletPort);
    recvAdd = receiveAddress.address;
    console.log(`Receive address: ${recvAdd}`);
    expect(aoppAddress).toBe(receiveAddress.displayAddress);
  });
});


// Ensure a clean state before running all tests.
test.beforeAll(async () => {
  deleteAccountsFile();
  cleanFakeMemoryFiles();
});

test.afterAll(async () => {
  await servewallet?.stop();
  if (aoppServer) {
    aoppServer.kill('SIGTERM');
    aoppServer = undefined;
  }
  await cleanupRegtest(regtest);
  if (simulatorProc) {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  }
});
