// SPDX-License-Identifier: Apache-2.0

import { apiPost } from '@/utils/request';
import type { TAccountCode } from './account';
import type { TSuccess } from './response';

export type TERC20CoinCode = 'erc20Test' | 'eth-erc20-usdt' | 'eth-erc20-usdc' | 'eth-erc20-link' | 'eth-erc20-bat' | 'eth-erc20-mkr' | 'eth-erc20-zrx' | 'eth-erc20-wbtc' | 'eth-erc20-paxg' | 'eth-erc20-dai0x6b17';

export type TERC20TokenUnit = 'USDT' | 'USDC' | 'LINK' | 'BAT' | 'MKR' | 'ZRX' | 'WBTC' | 'PAXG' | 'DAI';

type TERC20Token = {
  code: TERC20CoinCode;
  name: string;
  unit: TERC20TokenUnit;
};

export const supportedERC20Tokens: Readonly<TERC20Token[]> = [
  { code: 'eth-erc20-usdt', name: 'Tether USD', unit: 'USDT' },
  { code: 'eth-erc20-usdc', name: 'USD Coin', unit: 'USDC' },
  { code: 'eth-erc20-link', name: 'Chainlink', unit: 'LINK' },
  { code: 'eth-erc20-bat', name: 'Basic Attention Token', unit: 'BAT' },
  { code: 'eth-erc20-mkr', name: 'Maker', unit: 'MKR' },
  { code: 'eth-erc20-zrx', name: '0x', unit: 'ZRX' },
  { code: 'eth-erc20-wbtc', name: 'Wrapped Bitcoin', unit: 'WBTC' },
  { code: 'eth-erc20-paxg', name: 'Pax Gold', unit: 'PAXG' },
  { code: 'eth-erc20-dai0x6b17', name: 'Dai', unit: 'DAI' },
];

const supportedERC20Units = new Set(
  supportedERC20Tokens.map(({ unit }) => unit)
);

export const isSupportedERC20Unit = (
  unit: string,
): unit is TERC20TokenUnit => (
  supportedERC20Units.has(unit as TERC20TokenUnit)
);

export const setTokenActive = (
  accountCode: TAccountCode,
  tokenCode: TERC20CoinCode,
  active: boolean,
): Promise<TSuccess> => {
  return apiPost('set-token-active', { accountCode, tokenCode, active });
};
