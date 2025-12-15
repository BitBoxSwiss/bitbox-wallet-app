// SPDX-License-Identifier: Apache-2.0

import { spawn, ChildProcess } from 'child_process';
import type { Page } from '@playwright/test';
import { clickButtonWithText, typeIntoFocusedInput, clickAllAgreements } from './dom';
import { getLogFilePath } from './fs';
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
        if (err instanceof Error) {
          console.warn(`Failed to remove ${f}: ${err.message}`);
        } else {
          console.warn(`Failed to remove ${f}: ${String(err)}`);
        }
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
  testName: string,
  projectName: string,
  useFakeMemory = false
): ChildProcess {
  const env = { ...process.env };
  if (useFakeMemory) {
    env.FAKE_MEMORY_FILEPATH = '/tmp/fake_memory';
  }


  const logPath = getLogFilePath(testName, projectName, 'simulator.log');
  const outStream = fs.openSync(logPath, 'w');

  const proc = spawn(simulatorPath, { stdio: ['ignore', outStream, outStream], env });

  proc.on('error', (err) => {
    console.error('Simulator process error:', String(err));
  });

  proc.on('exit', (code, signal) => {
    console.log(`Simulator exited: code=${String(code)}, signal=${String(signal)}`);
    fs.closeSync(outStream); // close log file when simulator exits
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
