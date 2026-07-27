// SPDX-License-Identifier: Apache-2.0

const MEMPOOL_ONION_HOST = 'mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion';

// The onion targets below must stay whitelisted in `fixedURLWhitelist` in
// backend/backend.go, otherwise SystemOpen will block them. The keys must match
// the clearnet prefixes the backend reports (BlockExplorer{Transaction,Address}URLPrefix);
// unknown prefixes fall back to clearnet, so keep this map in sync with the backend.
const CLEARNET_TO_ONION_PREFIX: Readonly<Record<string, string>> = {
  'https://mempool.space/tx/': `http://${MEMPOOL_ONION_HOST}/tx/`,
  'https://mempool.space/address/': `http://${MEMPOOL_ONION_HOST}/address/`,
  'https://mempool.space/testnet/tx/': `http://${MEMPOOL_ONION_HOST}/testnet/tx/`,
  'https://mempool.space/testnet/address/': `http://${MEMPOOL_ONION_HOST}/testnet/address/`,
};

export const getMempoolExplorerUrl = (
  clearnetPrefix: string,
  id: string,
  useOnion: boolean,
): string => {
  if (!useOnion) {
    return `${clearnetPrefix}${id}`;
  }
  const onionPrefix = CLEARNET_TO_ONION_PREFIX[clearnetPrefix];
  if (!onionPrefix) {
    return `${clearnetPrefix}${id}`;
  }
  return `${onionPrefix}${id}`;
};
