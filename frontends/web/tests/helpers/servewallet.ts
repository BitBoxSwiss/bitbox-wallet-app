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

  constructor(
    page: Page,
    servewalletPort: number,
    frontendPort: number,
    host: string,
    testName: string,
    projectName: string,
    options: ServeWalletOptions = {}
  ) {
    const { simulator = false, timeout = 90000, testnet = true } = options;

    if (!testnet && simulator) {
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

    this.logPath = getLogFilePath(this.testName, this.projectName, 'servewallet.log');
    this.openOutStream(false); // On the first time, open the file in "w" mode.
  }

  private openOutStream(append: boolean): void {
    if (this.outStream) {
      fs.closeSync(this.outStream);
    }
    this.outStream = fs.openSync(this.logPath, append ? 'a' : 'w');
  }

  async start(): Promise<void> {
    this.openOutStream(true); // On starts/restarts, open the file in "a" mode.

    let target: string;
    if (this.testnet && !this.simulator) {
      target = 'servewallet';
    } else if (this.testnet && this.simulator) {
      target = 'servewallet-simulator';
    } else if (!this.testnet && !this.simulator) {
      target = 'servewallet-mainnet';
    } else {
      // This should never happen because the constructor already guards against it
      throw new Error('Invalid ServeWallet configuration');
    }

    this.proc = spawn('make', ['-C', '../../', target], {
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
          console.log(
            `Servewallet ready on ${this.host}:${this.servewalletPort} after ${Date.now() - start} ms`
          );
          return;
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
