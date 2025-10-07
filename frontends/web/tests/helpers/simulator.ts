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


import { spawn, ChildProcess } from 'child_process';
import type { Page } from '@playwright/test';
import { clickButtonWithText, typeIntoFocusedInput, clickAllAgreements } from './dom';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cleans up fake memory files in /tmp starting with 'fake_memory'.
 * This is useful to ensure a clean state before starting a simulator that uses fake memory.
 */
export function cleanFakeMemoryFiles() {
    const fakeMemoryDir = '/tmp';
    const fakeMemoryPrefix = 'fake_memory';
    // Remove all files starting with fake_memory in /tmp
   fs.readdirSync(fakeMemoryDir)
        .filter((f) => f.startsWith(fakeMemoryPrefix))
        .forEach((f) => {
            try {
                fs.unlinkSync(path.join(fakeMemoryDir, f));
            } catch (err) {
                console.warn(`Failed to remove ${f}: ${err}`);
            }
        });
}


/**
 * Spawns a simulator process and streams its output to the console.
 *
 *
 * @param simulatorPath - Path to the simulator binary or script.
 * @param useFakeMemory - If true, sets FAKE_MEMORY_FILEPATH to '/tmp/fake_memory'.
 * @returns The spawned ChildProcess instance.
 */
export function startSimulator(
  simulatorPath: string,
  useFakeMemory = false
): ChildProcess {
  const env = { ...process.env };
  if (useFakeMemory) env.FAKE_MEMORY_FILEPATH = '/tmp/fake_memory';

  const proc = spawn(simulatorPath, { stdio: 'pipe', env });

  // Pipe output to logs (needed in CI)
  proc.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  proc.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  proc.on('error', (err) => {
    console.error('Simulator process error:', err);
  });

  proc.on('exit', (code, signal) => {
    console.log(`Simulator exited: code=${code}, signal=${signal}`);
  });

  return proc;
}

/**
 * Performs the wallet setup flow in order:
 * 1. Click "Continue"
 * 2. Click "Create wallet"
 * 3. Type "simulator" into focused input
 * 4. Click "Continue"
 * 5. Click all checkboxes
 * 6. Click "Continue"
 * 7. Click "Get started"
 */
export async function completeWalletSetupFlow(page: Page) {
  await clickButtonWithText(page, 'Continue');
  await clickButtonWithText(page, 'Create wallet');
  await typeIntoFocusedInput(page, 'simulator');
  await clickButtonWithText(page, 'Continue');
  await clickAllAgreements(page);
  await clickButtonWithText(page, 'Continue');
  await clickButtonWithText(page, 'Get started');
}
