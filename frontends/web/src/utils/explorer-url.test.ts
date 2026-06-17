// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getMempoolExplorerUrls } from './explorer-url';

const TX_ID = 'abc123';
const ADDRESS = 'bc1qexample';

describe('getMempoolExplorerUrls', () => {
  it('returns clearnet URLs when onion mode is disabled', () => {
    expect(getMempoolExplorerUrls('https://mempool.space/tx/', TX_ID, false)).toEqual({
      href: `https://mempool.space/tx/${TX_ID}`,
      clearnetHref: `https://mempool.space/tx/${TX_ID}`,
    });
  });

  it('maps mainnet tx prefix to onion', () => {
    expect(getMempoolExplorerUrls('https://mempool.space/tx/', TX_ID, true)).toEqual({
      href: `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/tx/${TX_ID}`,
      clearnetHref: `https://mempool.space/tx/${TX_ID}`,
    });
  });

  it('maps mainnet address prefix to onion', () => {
    expect(getMempoolExplorerUrls('https://mempool.space/address/', ADDRESS, true)).toEqual({
      href: `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/address/${ADDRESS}`,
      clearnetHref: `https://mempool.space/address/${ADDRESS}`,
    });
  });

  it('maps testnet tx prefix to onion', () => {
    expect(getMempoolExplorerUrls('https://mempool.space/testnet/tx/', TX_ID, true)).toEqual({
      href: `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/testnet/tx/${TX_ID}`,
      clearnetHref: `https://mempool.space/testnet/tx/${TX_ID}`,
    });
  });

  it('maps testnet address prefix to onion', () => {
    expect(getMempoolExplorerUrls('https://mempool.space/testnet/address/', ADDRESS, true)).toEqual({
      href: `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/testnet/address/${ADDRESS}`,
      clearnetHref: `https://mempool.space/testnet/address/${ADDRESS}`,
    });
  });

  it('returns clearnet URLs for unknown explorer prefixes', () => {
    const prefix = 'https://etherscan.io/tx/';
    expect(getMempoolExplorerUrls(prefix, TX_ID, true)).toEqual({
      href: `${prefix}${TX_ID}`,
      clearnetHref: `${prefix}${TX_ID}`,
    });
  });
});
