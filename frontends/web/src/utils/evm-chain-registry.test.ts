// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import app from '@/locales/en/app.json';
import { EVM_CHAIN_REGISTRY } from './evm-chain-registry';

const svgIcon = () => expect.stringMatching(/^(?:data:image\/svg\+xml|.*\.svg$)/);

describe('EVM_CHAIN_REGISTRY', () => {
  it('contains metadata and SVG icons for exactly the supported EVM chains', () => {
    expect(Object.entries(EVM_CHAIN_REGISTRY).map(([chainID, chain]) => ({
      chainID: Number(chainID),
      icon: chain.icon,
      nameKey: chain.nameKey,
    }))).toEqual([
      { chainID: 1, icon: svgIcon(), nameKey: 'evmChains.ethereumMainnet' },
      { chainID: 10, icon: svgIcon(), nameKey: 'evmChains.optimism' },
      { chainID: 56, icon: svgIcon(), nameKey: 'evmChains.bnbSmartChain' },
      { chainID: 100, icon: svgIcon(), nameKey: 'evmChains.gnosis' },
      { chainID: 137, icon: svgIcon(), nameKey: 'evmChains.polygon' },
      { chainID: 146, icon: svgIcon(), nameKey: 'evmChains.sonic' },
      { chainID: 999, icon: svgIcon(), nameKey: 'evmChains.hyperEVM' },
      { chainID: 8453, icon: svgIcon(), nameKey: 'evmChains.base' },
      { chainID: 42161, icon: svgIcon(), nameKey: 'evmChains.arbitrumOne' },
      { chainID: 11155111, icon: svgIcon(), nameKey: 'evmChains.ethereumSepoliaTestnet' },
    ]);

    expect(app.evmChains).toEqual({
      arbitrumOne: 'Arbitrum One',
      base: 'Base',
      bnbSmartChain: 'BNB Smart Chain',
      ethereumMainnet: 'Ethereum mainnet',
      ethereumSepoliaTestnet: 'Ethereum Sepolia testnet',
      gnosis: 'Gnosis',
      hyperEVM: 'HyperEVM',
      optimism: 'Optimism',
      polygon: 'Polygon',
      sonic: 'Sonic',
    });
  });
});
