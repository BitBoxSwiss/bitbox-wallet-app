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
import { expect } from '@playwright/test';
import { ServeWallet } from './helpers/servewallet';
import { launchRegtest, setupRegtestWallet, sendCoins, mineBlocks, cleanupRegtest } from './helpers/regtest';
import { startSimulator, completeWalletSetupFlow, cleanFakeMemoryFiles } from './helpers/simulator';
import { ChildProcess } from 'child_process';
import { startAOPPServer, generateAOPPRequest } from './helpers/aopp';


let servewallet: ServeWallet;
let regtest: ChildProcess;
let aoppServer: ChildProcess | undefined;
let simulatorProc : ChildProcess | undefined;

test('AOPP', async ({ page, host, frontendPort, servewalletPort }, testInfo) => {


  await test.step('Start regtest and init wallet', async () => {
    regtest = await launchRegtest();
    // Give regtest some time to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await setupRegtestWallet();
  });


  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name, { regtest: true, testnet: false, simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    const simulatorPath = process.env.SIMULATOR_PATH;
    if (!simulatorPath) {
      throw new Error('SIMULATOR_PATH environment variable not set');
    }

    simulatorProc = startSimulator(simulatorPath, testInfo.title, testInfo.project.name, true);
    console.log('Simulator started');
  });


  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  let recvAdd: string;
  await test.step('Grab receive address', async () => {
    await page.getByRole('link', { name: 'Bitcoin Regtest Bitcoin' }).click();
    await page.getByRole('button', { name: 'Receive RBTC' }).click();
    await page.getByRole('button', { name: 'Verify address on BitBox' }).click();
    const addressLocator = page.locator('[data-testid="receive-address"]');
    recvAdd = await addressLocator.inputValue();
    console.log(`Receive address: ${recvAdd}`);
  });

  await test.step('Send RBTC to receive address', async () => {
    await page.waitForTimeout(2000);
    const sendAmount = '10';
    await sendCoins(recvAdd, sendAmount);
    await mineBlocks(12);
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

  await test.step('Kill servewallet and restart with AOPP request', async () => {
    await servewallet.stop();
    console.log('Servewallet stopped.');
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.title, testInfo.project.name, { regtest: true, testnet: false, simulator: true });
    await servewallet.start({ extraFlags: { aoppUrl: aoppRequest } });
    console.log('Servewallet restarted with AOPP request.');
  });

  let aoppAddress : string | null;
  await test.step('Verify AOPP flow is in progress', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();

    const body = page.locator('body');
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
    await page.getByRole('button', { name: 'Verify address on BitBox' }).click();
    const addressLocator = page.locator('[data-testid="receive-address"]');
    recvAdd = await addressLocator.inputValue();
    console.log(`Receive address: ${recvAdd}`);
    expect(recvAdd).toBe(aoppAddress);
  });
});


// Ensure a clean state before running all tests.
test.beforeAll(async () => {
  cleanFakeMemoryFiles();
});

test.afterAll(async () => {
  await servewallet.stop();
  if (aoppServer) {
    aoppServer.kill('SIGTERM');
    aoppServer = undefined;
  }
  await cleanupRegtest(regtest);
  if (simulatorProc) {
    simulatorProc.kill('SIGTERM');
    simulatorProc = undefined;
  }
});
