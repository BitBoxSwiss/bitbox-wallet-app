// SPDX-License-Identifier: Apache-2.0

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleKind, transpileModule } from 'typescript';

type TTestWindow = typeof window & {
  reply: (message: string) => void;
  ready: number;
  replies: string[];
};

test('delayed replies stay bound to the original iframe and origin', async ({ page }) => {
  const helper = transpileModule(readFileSync(join(__dirname, '../src/hooks/vendor-iframe-message.ts'), 'utf8'), {
    compilerOptions: { module: ModuleKind.ESNext },
  }).outputText;
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.endsWith('/helper.js')) {
      return route.fulfill({ contentType: 'application/javascript', body: helper });
    }
    const body = (
      url === 'https://app.test/' ? `
      <script type="module">
        import { getVendorIframeMessageTarget, postMessageToVendorIframe } from './helper.js';
        let target;
        window.ready = 0;
        window.replies = [];
        window.reply = message => postMessageToVendorIframe(target, message);
        window.addEventListener('message', event => {
          if (event.data === 'ready') {
            window.ready++;
            const candidate = getVendorIframeMessageTarget(event, document.querySelector('iframe'));
            if (!target && candidate && candidate.origin === 'https://vendor.test') target = candidate;
          } else {
            window.replies.push(event.data);
          }
        });
        const iframe = document.createElement('iframe');
        iframe.src = 'https://vendor.test/';
        document.body.appendChild(iframe);
      </script>` : `
      <script>
        window.addEventListener('message', event => parent.postMessage(event.data, '*'));
        parent.postMessage('ready', '*');
      </script>`
    );
    return route.fulfill({ contentType: 'text/html', body });
  });
  await page.goto('https://app.test/');
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).ready)).toBe(1);
  await page.evaluate(() => (window as TTestWindow).reply('valid reply'));
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).replies)).toEqual(['valid reply']);

  await page.evaluate(() => document.querySelector('iframe')!.src = 'https://attacker.test/');
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).ready)).toBe(2);
  await page.evaluate(() => {
    (window as TTestWindow).reply('must not reach the other origin');
    // A later message provides a delivery barrier without an arbitrary sleep.
    document.querySelector('iframe')!.contentWindow!.postMessage('navigation barrier', '*');
  });
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).replies))
    .toEqual(['valid reply', 'navigation barrier']);

  await page.evaluate(() => {
    document.querySelector('iframe')!.remove();
    const iframe = document.createElement('iframe');
    iframe.src = 'https://vendor.test/replacement';
    document.body.appendChild(iframe);
  });
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).ready)).toBe(3);
  await page.evaluate(() => {
    (window as TTestWindow).reply('must not reach a replacement iframe');
    document.querySelector('iframe')!.contentWindow!.postMessage('replacement barrier', '*');
  });
  await expect.poll(() => page.evaluate(() => (window as TTestWindow).replies))
    .toEqual(['valid reply', 'navigation barrier', 'replacement barrier']);
});
