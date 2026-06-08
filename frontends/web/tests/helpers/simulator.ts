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
 * @param outputDir - Playwright's per-test output directory.
 * @param useFakeMemory - If true, sets FAKE_MEMORY_FILEPATH to '/tmp/fake_memory'.
 * @returns The spawned ChildProcess instance.
 */
export function startSimulator(
  simulatorPath: string,
  outputDir: string,
  useFakeMemory = false
): ChildProcess {
  const env = { ...process.env };
  if (useFakeMemory) {
    env.FAKE_MEMORY_FILEPATH = '/tmp/fake_memory';
  } else {
    delete env.FAKE_MEMORY_FILEPATH;
  }


  const logPath = getLogFilePath(outputDir, 'simulator.log');
  const outStream = fs.openSync(logPath, 'w');

  const proc = spawn(simulatorPath, {
    stdio: ['ignore', outStream, outStream],
    env,
    detached: true,
  });

  proc.on('error', (err) => {
    console.error('Simulator process error:', String(err));
  });

  proc.on('exit', (code, signal) => {
    console.log(`Simulator exited: code=${String(code)}, signal=${String(signal)}`);
    fs.closeSync(outStream); // close log file when simulator exits
  });

  return proc;
}

export function stopSimulator(proc?: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!proc?.pid) {
      resolve();
      return;
    }

    if (proc.exitCode !== null || proc.signalCode !== null) {
      resolve();
      return;
    }

    const onExit = () => resolve();
    proc.once('exit', onExit);
    try {
      const killed = process.platform === 'win32'
        ? proc.kill('SIGTERM')
        : (() => {
          try {
            process.kill(-proc.pid!, 'SIGTERM');
            return true;
          } catch {
            return proc.kill('SIGTERM');
          }
        })();

      if (!killed) {
        proc.off('exit', onExit);
        resolve();
      }
    } catch {
      proc.off('exit', onExit);
      resolve();
    }
  });
}


/**
 * Performs the wallet setup flow.
 *
 * Depending on the simulator state, the setup can start either on the pairing
 * confirmation screen or directly on the setup options screen.
 *
 * The flow is:
 * 1. Optionally click "Continue"
 * 2. Click "Create wallet"
 * 3. Type the device name into the focused input
 * 4. Click "Continue"
 * 5. Click all checkboxes
 * 6. Click "Continue"
 * 7. Click "Get started"
 */
export async function completeWalletSetupFlow(page: Page, deviceName = 'simulator') {
  const continueButton = page.locator('button', { hasText: 'Continue' }).first();
  const createWalletButton = page.locator('button', { hasText: 'Create wallet' }).first();

  await Promise.race([
    continueButton.waitFor({ state: 'visible' }),
    createWalletButton.waitFor({ state: 'visible' }),
  ]);

  if (await continueButton.isVisible()) {
    await continueButton.click();
  }

  await clickButtonWithText(page, 'Create wallet');
  await typeIntoFocusedInput(page, deviceName);
  await clickButtonWithText(page, 'Continue');
  await clickAllAgreements(page);
  await clickButtonWithText(page, 'Continue');
  await clickButtonWithText(page, 'Get started');
}
