import { spawn } from 'child_process';
import  * as net  from 'net';
import { Page } from '@playwright/test';

export async function startServeWallet() {
    spawn(
        'make',
        ['-C', '../../', 'servewallet'],
        { stdio: 'inherit' }
    );
};

export async function waitForServewallet(page: Page, port = 8082, host = 'localhost', timeout = 180000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.once('error', reject);
        socket.once('connect', () => {
          socket.end();
          resolve();
        });
        socket.connect(port, host);
      });
      await page.goto('http://localhost:8080');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200)); // retry after 200ms
    }
  }

  throw new Error(`Timeout waiting for port ${port}`);
}
