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

import { spawn } from 'child_process';
import  * as net  from 'net';
import type { Page } from '@playwright/test';

export async function startServeWallet() {
    spawn(
        'make',
        ['-C', '../../', 'servewallet'],
        { stdio: 'inherit' }
    );
};

function connectOnce(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.once('error', reject);
  });
}


export async function waitForServewallet(
  page: Page,
  servewalletPort: number,
  frontendPort: number,
  host: string,
  timeout = 90000,
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await connectOnce(host, servewalletPort);
      await page.goto(`http://${host}:${frontendPort}`);
      const elapsed = Date.now() - start;
      console.log(`Connected to servewallet on ${host}:${servewalletPort} after ${elapsed} ms`);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));

    }
  }
  throw new Error(`Timeout exceeded waiting for servewallet on ${host}:${servewalletPort}`);
}
