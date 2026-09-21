// SPDX-License-Identifier: Apache-2.0

import { expect, test, type Frame, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type TWidget = 'bitrefill/bitrefill.html' | 'btcdirect/fiat-to-coin.html' | 'btcdirect/coin-to-fiat.html';
type TParent = 'https' | 'http' | 'opaque';
type TTestWindow = typeof window & {
  received: { origin: string; data: any }[];
  btcdirect: { q: IArguments[] };
};

const wrapperOrigin = 'https://bitboxapp.shiftcrypto.io';
const bitrefillOrigin = 'https://embed.bitrefill.com';
const bitrefillConfig = {
  event: 'configuration', ref: 'test', utm_source: 'BITBOX', theme: 'light', hl: 'en',
  paymentMethods: 'bitcoin', refundAddress: 'test-refund-address', paymentPending: 'true',
  region: '', showPaymentInfo: 'true',
};
const btcDirectConfig = {
  action: 'configuration', address: 'test-receive-address', apiKey: 'test',
  baseCurrency: 'BTC', quoteCurrency: 'EUR', locale: 'en-GB', theme: 'light', mode: 'production',
};
const payment = {
  event: 'payment_intent', invoiceId: 'expected', paymentMethod: 'bitcoin',
  paymentAmount: '0.001', paymentAddress: 'test-payment-address',
};

// Serve the actual wrapper HTML with an app implementing the protocol from before
// c1780d48f. No new handshake fields, native bridge, backend or live vendor SDK.
const openWidget = async (page: Page, widget: TWidget, parent: TParent = 'https') => {
  const vendor = widget.split('/')[0]!;
  const filename = widget.split('/')[1]!;
  const widgetURL = `${wrapperOrigin}/widgets/${vendor}/v1/${filename}`;
  const config = vendor === 'bitrefill' ? bitrefillConfig : btcDirectConfig;
  const html = readFileSync(join(__dirname, '../public', widget), 'utf8');
  const app = `<script>
    window.addEventListener('message', event => {
      if (event.origin !== '${wrapperOrigin}') return;
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if ((data.event || data.action) === 'request-configuration') {
        event.source.postMessage(${JSON.stringify(config)}, { targetOrigin: event.origin });
      }
    });
    </script><iframe id="widget" width="800" height="600" src="${widgetURL}"
      ${vendor === 'bitrefill' ? 'sandbox="allow-same-origin allow-popups allow-scripts allow-forms"' : ''}></iframe>`;

  await page.context().addInitScript(() => {
    const current = window as TTestWindow;
    current.received = [];
    window.addEventListener('message', event => {
      current.received.push({ origin: event.origin, data: event.data });
    });
  });
  await page.context().route('**/*', route => {
    const url = route.request().url();
    let body = '<body></body>';
    if (url === widgetURL) {
      body = html;
    } else if (url === 'https://legacy-app.test/' || url === 'http://legacy-app.test/') {
      body = app;
    } else if (url.startsWith(bitrefillOrigin)) {
      body = '<button onclick="window.open(\'https://attacker.test/\')">Open popup</button>';
    }
    // The wrappers' btcdirect command queue stands in for the external SDK.
    return route.fulfill({
      contentType: url.endsWith('.js') ? 'application/javascript' : 'text/html',
      body: url.endsWith('.js') ? '' : body,
    });
  });
  await page.goto(parent === 'opaque'
    ? `data:text/html,${encodeURIComponent(app)}`
    : `${parent}://legacy-app.test/`);
  await expect.poll(() => page.frames().find(frame => frame.url() === widgetURL)?.url()).toBe(widgetURL);
  const wrapper = page.frames().find(frame => frame.url() === widgetURL)!;
  if (vendor === 'bitrefill') {
    await expect(wrapper.locator('iframe')).toHaveCount(1);
    await expect.poll(() => wrapper.childFrames()[0]?.url()).toContain(bitrefillOrigin);
  } else {
    await expect.poll(() => wrapper.evaluate(() => (window as TTestWindow).btcdirect?.q.length || 0)).toBeGreaterThan(0);
  }
  return wrapper;
};

const sendFromApp = async (page: Page, data: unknown) => {
  await page.evaluate(({ data, origin }) => {
    (document.querySelector('#widget') as HTMLIFrameElement).contentWindow!
      .postMessage(data, { targetOrigin: origin });
  }, { data, origin: wrapperOrigin });
};

// Wait for actual delivery, so rejection checks cannot pass before the message arrives.
const deliver = async (wrapper: Frame, send: () => Promise<unknown>) => {
  const count = await wrapper.evaluate(() => (window as TTestWindow).received.length);
  await send();
  await expect.poll(() => wrapper.evaluate(() => (window as TTestWindow).received.length)).toBe(count + 1);
};

const paymentMessages = (page: Page) => page.evaluate(() =>
  (window as TTestWindow).received.filter(({ data }) => data?.event === 'payment_intent').map(({ data }) => data));

for (const parent of ['https', 'http', 'opaque'] as const) {
  test(`Bitrefill preserves the old ${parent} app handshake and payment format`, async ({ page }) => {
    const wrapper = await openWidget(page, 'bitrefill/bitrefill.html', parent);
    const inner = wrapper.childFrames()[0]!;
    await inner.evaluate(data => window.parent.postMessage(JSON.stringify(data), '*'), payment);
    await expect.poll(() => paymentMessages(page)).toEqual([payment]);

    // A repeated configuration should leave exactly one active widget.
    await deliver(wrapper, () => sendFromApp(page, bitrefillConfig));
    await expect(wrapper.locator('iframe')).toHaveCount(1);
    await expect.poll(() => wrapper.childFrames()[0]?.url()).toContain(bitrefillOrigin);
    const replacement = wrapper.childFrames()[0]!;
    await replacement.evaluate(data => window.parent.postMessage(data, '*'), { ...payment, invoiceId: 'replacement' });
    await expect.poll(() => paymentMessages(page)).toHaveLength(2);
  });

  for (const direction of ['fiat-to-coin', 'coin-to-fiat'] as const) {
    test(`BTC Direct ${direction} preserves the old ${parent} app protocol`, async ({ page }) => {
      const wrapper = await openWidget(page, `btcdirect/${direction}.html`, parent);
      const commands = () => wrapper.evaluate(() => (window as TTestWindow).btcdirect.q.map(args => Array.from(args)));
      if (direction === 'fiat-to-coin') {
        expect(await commands()).toContainEqual(['wallet-addresses', {
          addresses: { address: btcDirectConfig.address, currency: 'BTC', id: 'BitBox', walletName: 'BitBox' },
        }]);
      } else {
        await wrapper.evaluate(() => window.dispatchEvent(new CustomEvent('btcdirect-embeddable-coin-to-fiat-order-requested', {
          detail: { orderId: 'order', amount: 0.001, currency: 'BTC', walletAddress: 'test-payment-address' },
        })));
        await expect.poll(() => page.evaluate(() =>
          (window as TTestWindow).received.find(({ data }) => data?.action === 'request-payment')?.data)
        ).toEqual({ action: 'request-payment', orderId: 'order', amount: '0.001', currency: 'BTC', walletAddress: 'test-payment-address' });

        await deliver(wrapper, () => sendFromApp(page, { action: 'confirm-transaction-id', transactionId: 'txid' }));
        expect(await commands()).toContainEqual(['transaction-id-confirmation', { orderId: 'order', transactionId: 'txid' }]);
        await deliver(wrapper, () => sendFromApp(page, { action: 'cancel-order' }));
        expect(await commands()).toContainEqual(['coin-to-fiat-order-canceled']);
      }
    });
  }
}

test('Bitrefill rejects popup forwarding, foreign configuration and malformed messages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const wrapper = await openWidget(page, 'bitrefill/bitrefill.html');
  const inner = wrapper.childFrames()[0]!;
  const popupPromise = page.waitForEvent('popup');
  await inner.getByRole('button', { name: 'Open popup' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await deliver(wrapper, () => popup.evaluate(data => window.opener.parent.postMessage(data, '*'), { ...payment, invoiceId: 'forged' }));
  await deliver(wrapper, () => inner.evaluate(data => window.parent.postMessage(data, '*'), { ...bitrefillConfig, refundAddress: 'forged' }));
  await deliver(wrapper, () => inner.evaluate(() => window.parent.postMessage('invalid JSON', '*')));
  await expect(wrapper.locator('iframe')).toHaveCount(1);
  await inner.evaluate(data => window.parent.postMessage(data, '*'), payment);
  await expect.poll(() => paymentMessages(page)).toEqual([payment]);
  expect(errors).toEqual([]);
});

test('Bitrefill rejects another window at the correct origin and its own iframe at a wrong origin', async ({ page }) => {
  const wrapper = await openWidget(page, 'bitrefill/bitrefill.html');
  await page.evaluate(origin => {
    const iframe = document.createElement('iframe');
    iframe.src = origin + '/unrelated';
    document.body.appendChild(iframe);
  }, bitrefillOrigin);
  await expect.poll(() => page.frames().find(frame => frame.url().endsWith('/unrelated'))?.url()).toBe(bitrefillOrigin + '/unrelated');
  const unrelated = page.frames().find(frame => frame.url().endsWith('/unrelated'))!;
  await deliver(wrapper, () => unrelated.evaluate(data => window.parent.frames[0]!.postMessage(data, '*'), { ...payment, invoiceId: 'wrong-window' }));

  const inner = wrapper.childFrames()[0]!;
  const innerURL = inner.url();
  await inner.goto('https://attacker.test/');
  await deliver(wrapper, () => inner.evaluate(data => window.parent.postMessage(data, '*'), { ...payment, invoiceId: 'wrong-origin' }));
  await inner.goto(innerURL);
  await inner.evaluate(data => window.parent.postMessage(data, '*'), payment);
  await expect.poll(() => paymentMessages(page)).toEqual([payment]);
});

for (const direction of ['fiat-to-coin', 'coin-to-fiat'] as const) {
  test(`BTC Direct ${direction} rejects app commands from another window`, async ({ page }) => {
    const wrapper = await openWidget(page, `btcdirect/${direction}.html`);
    const initialCommands = await wrapper.evaluate(() => (window as TTestWindow).btcdirect.q);
    // Same origin as the app: an origin-only check would incorrectly accept this.
    await page.evaluate(() => {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://legacy-app.test/unrelated';
      document.body.appendChild(iframe);
    });
    await expect.poll(() => page.frames().find(frame => frame.url().endsWith('/unrelated'))?.url()).toBe('https://legacy-app.test/unrelated');
    const unrelated = page.frames().find(frame => frame.url().endsWith('/unrelated'))!;
    for (const data of [
      { ...btcDirectConfig, address: 'forged', baseCurrency: 'ETH' },
      { action: 'confirm-transaction-id', transactionId: 'forged' },
      { action: 'cancel-order' },
    ]) {
      await deliver(wrapper, () => unrelated.evaluate(message => window.parent.frames[0]!.postMessage(message, '*'), data));
    }
    expect(await wrapper.evaluate(() => (window as TTestWindow).btcdirect.q)).toEqual(initialCommands);
  });
}
