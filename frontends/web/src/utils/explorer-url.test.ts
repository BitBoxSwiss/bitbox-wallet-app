// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getMempoolExplorerUrl } from './explorer-url';

const TX_ID = 'abc123';
const ADDRESS = 'bc1qexample';

describe('getMempoolExplorerUrl', () => {
  it('returns the clearnet URL when onion mode is disabled', () => {
    expect(getMempoolExplorerUrl('https://mempool.space/tx/', TX_ID, false)).toBe(
      `https://mempool.space/tx/${TX_ID}`,
    );
  });

  it('maps mainnet tx prefix to onion', () => {
    expect(getMempoolExplorerUrl('https://mempool.space/tx/', TX_ID, true)).toBe(
      `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/tx/${TX_ID}`,
    );
  });

  it('maps mainnet address prefix to onion', () => {
    expect(getMempoolExplorerUrl('https://mempool.space/address/', ADDRESS, true)).toBe(
      `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/address/${ADDRESS}`,
    );
  });

  it('maps testnet tx prefix to onion', () => {
    expect(getMempoolExplorerUrl('https://mempool.space/testnet/tx/', TX_ID, true)).toBe(
      `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/testnet/tx/${TX_ID}`,
    );
  });

  it('maps testnet address prefix to onion', () => {
    expect(getMempoolExplorerUrl('https://mempool.space/testnet/address/', ADDRESS, true)).toBe(
      `http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/testnet/address/${ADDRESS}`,
    );
  });

  it('returns the clearnet URL for unknown explorer prefixes', () => {
    const prefix = 'https://etherscan.io/tx/';
    expect(getMempoolExplorerUrl(prefix, TX_ID, true)).toBe(`${prefix}${TX_ID}`);
  });
});
