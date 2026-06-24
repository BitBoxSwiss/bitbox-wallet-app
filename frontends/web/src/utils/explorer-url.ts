// SPDX-License-Identifier: Apache-2.0

const MEMPOOL_ONION_HOST = 'mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion';

const CLEARNET_TO_ONION_PREFIX: Readonly<Record<string, string>> = {
  'https://mempool.space/tx/': `http://${MEMPOOL_ONION_HOST}/tx/`,
  'https://mempool.space/address/': `http://${MEMPOOL_ONION_HOST}/address/`,
  'https://mempool.space/testnet/tx/': `http://${MEMPOOL_ONION_HOST}/testnet/tx/`,
  'https://mempool.space/testnet/address/': `http://${MEMPOOL_ONION_HOST}/testnet/address/`,
};

export type TExplorerUrls = Readonly<{
  href: string;
  clearnetHref: string;
}>;

export const getMempoolExplorerUrls = (
  clearnetPrefix: string,
  id: string,
  useOnion: boolean,
): TExplorerUrls => {
  const clearnetHref = `${clearnetPrefix}${id}`;
  if (!useOnion) {
    return { href: clearnetHref, clearnetHref };
  }
  const onionPrefix = CLEARNET_TO_ONION_PREFIX[clearnetPrefix];
  if (!onionPrefix) {
    return { href: clearnetHref, clearnetHref };
  }
  return { href: `${onionPrefix}${id}`, clearnetHref };
};
