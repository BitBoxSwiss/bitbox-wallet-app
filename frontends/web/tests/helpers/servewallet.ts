// SPDX-License-Identifier: Apache-2.0

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as fs from 'fs';
import type { Page } from '@playwright/test';
import { getLogFilePath } from './fs';

async function connectOnce(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.once('error', reject);
  });
}

export interface ServeWalletOptions {
  simulator?: boolean;
  timeout?: number;
  testnet?: boolean;
  regtest?: boolean;
  /**
   * Extra flags to pass to the servewallet
   *
   * Valid values are thospe specified in `cmd/servewallet/main.go`
   * which can be obtained also by running `go run ./cmd/servewallet --help`
   * from the project root.
   */
  extraFlags?: Record<string, string | number | boolean | null>;
}

export class ServeWallet {
  private proc?: ChildProcess;
  private outStream?: number;
  private readonly simulator: boolean;
  private readonly page: Page;
  private readonly servewalletPort: number;
  private readonly frontendPort: number;
  private readonly host: string;
  private readonly timeout: number;
  private readonly testnet: boolean;
  private readonly testName: string;
  private readonly projectName: string;
  private readonly logPath: string;
  private readonly regtest: boolean;

  constructor(
    page: Page,
    servewalletPort: number,
    frontendPort: number,
    host: string,
    testName: string,
    projectName: string,
    options: ServeWalletOptions = {}
  ) {
    const { simulator = false, timeout = 90000, testnet = true, regtest = false } = options;

    if (!(testnet || regtest) && simulator) {
      throw new Error('ServeWallet: mainnet simulator is not supported');
    }

    this.page = page;
    this.servewalletPort = servewalletPort;
    this.frontendPort = frontendPort;
    this.host = host;
    this.simulator = simulator;
    this.timeout = timeout;
    this.testnet = testnet;
    this.testName = testName;
    this.projectName = projectName;

    this.regtest = regtest;
    this.logPath = getLogFilePath(this.testName, this.projectName, 'servewallet.log');
    this.openOutStream(false); // On the first time, open the file in "w" mode.
  }

  private openOutStream(append: boolean): void {
    if (this.outStream) {
      fs.closeSync(this.outStream);
    }
    this.outStream = fs.openSync(this.logPath, append ? 'a' : 'w');
  }

  async start(options: ServeWalletOptions = {}): Promise<void> {
    this.openOutStream(true); // On starts/restarts, open the file in "a" mode.

    const extraFlags = options.extraFlags || {};

    // Determine base flags
    const args: string[] = ['./cmd/servewallet'];
    if (!this.testnet && !this.simulator && !this.regtest) {
      args.push('-mainnet');
    }
    if (this.simulator) {
      args.push('-simulator');
    }
    if (this.regtest) {
      args.push('-regtest');
    }

    // Append extra flags, disallow overriding reserved ones
    const reservedFlags = ['mainnet', 'testnet', 'regtest', 'simulator'];
    for (const [key, value] of Object.entries(extraFlags)) {
      if (reservedFlags.includes(key)) {
        throw new Error(`Cannot override reserved flag "${key}" in extraFlags`);
      }
      if (value === null || value === true) {
        args.push(`-${key}`);
      } else if (value === false) {
        // skip false flags
        continue;
      } else {
        args.push(`-${key}=${value}`);
      }
    }

    this.proc = spawn('go', ['run', ...args], {
      cwd: '../../', // maintain previous working dir
      stdio: ['ignore', this.outStream, this.outStream],
      detached: true,
    });

    await this.waitUntilReady();
  }

  private async waitUntilReady(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < this.timeout) {
      try {
        await connectOnce(this.host, this.servewalletPort);
        try {
          await this.page.goto(`http://${this.host}:${this.frontendPort}`);
          // Wait for body to be loaded
          const bodyText = await this.page.textContent('body');

          if (bodyText && (bodyText.includes('Welcome') || bodyText.includes('My portfolio'))) {
            console.log(
              `Servewallet ready on ${this.host}:${this.servewalletPort} after ${Date.now() - start} ms`
            );
            return;
          }
        } catch {
          // page.goto failed; likely connection refused; retry
        }
      } catch {
        // port not ready yet
      }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timeout exceeded waiting for servewallet on ${this.host}:${this.servewalletPort}`);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.proc?.pid) {
        console.log('ServeWallet process not running');
        resolve();
        return;
      }

      const pid = this.proc.pid;
      console.log(`Stopping servewallet (pid=${pid})...`);

      // Listen for exit event
      this.proc.once('exit', () => {
        console.log('Servewallet stopped');
        this.proc = undefined;

        if (this.outStream) {
          try {
            fs.closeSync(this.outStream);
            console.log('Servewallet log file closed');
          } catch (err) {
            console.warn('Failed to close servewallet log file:', err);
          } finally {
            this.outStream = undefined;
          }
        }

        resolve();
      });

      try {
        process.kill(-pid, 'SIGTERM');
      } catch (err) {
        console.error('Failed to stop servewallet:', err);
        resolve();
      }
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}
