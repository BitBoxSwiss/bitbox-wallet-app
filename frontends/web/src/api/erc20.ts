// SPDX-License-Identifier: Apache-2.0

export type ERC20CoinCode = 'erc20Test' | 'eth-erc20-usdt' | 'eth-erc20-usdc' | 'eth-erc20-link' | 'eth-erc20-bat' | 'eth-erc20-mkr' | 'eth-erc20-zrx' | 'eth-erc20-wbtc' | 'eth-erc20-paxg' | 'eth-erc20-dai0x6b17';

export type ERC20TokenUnit = 'USDT' | 'USDC' | 'LINK' | 'BAT' | 'MKR' | 'ZRX' | 'WBTC' | 'PAXG' | 'DAI';

export type Terc20Token = {
  code: ERC20CoinCode;
  name: string;
  unit: ERC20TokenUnit;
};

export const supportedERC20Tokens: Readonly<Terc20Token[]> = [
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
