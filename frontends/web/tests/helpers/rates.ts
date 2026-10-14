// SPDX-License-Identifier: Apache-2.0

import { createServer } from 'http';
import type { AddressInfo } from 'net';

// Serve fixed market data to the Go backend so rate-dependent tests work offline.
export const startRatesServer = async () => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    response.setHeader('Content-Type', 'application/json');
    if (pathname === '/simple/price') {
      response.end(JSON.stringify({
        bitcoin: { usd: 50000, eur: 45000, chf: 45000 },
        litecoin: { usd: 100, eur: 90, chf: 90 },
        ethereum: { usd: 3000, eur: 2700, chf: 2700 },
      }));
    } else if (/^\/coins\/[^/]+\/market_chart\/range$/.test(pathname)) {
      response.end(JSON.stringify({ prices: [] }));
    } else {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
};
