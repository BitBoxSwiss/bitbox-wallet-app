// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { EVM_CHAIN_REGISTRY } from './evm-chain-registry';

const svgIcon = () => expect.stringMatching(/^(?:data:image\/svg\+xml|.*\.svg$)/);

describe('EVM_CHAIN_REGISTRY', () => {
  it('contains metadata and SVG icons for exactly the supported EVM chains', () => {
    expect(Object.entries(EVM_CHAIN_REGISTRY).map(([chainID, chain]) => ({
      chainID: Number(chainID),
      icon: chain.icon,
      name: chain.name,
    }))).toEqual([
      { chainID: 1, icon: svgIcon(), name: 'Ethereum mainnet' },
      { chainID: 10, icon: svgIcon(), name: 'Optimism' },
      { chainID: 56, icon: svgIcon(), name: 'BNB Smart Chain' },
      { chainID: 100, icon: svgIcon(), name: 'Gnosis' },
      { chainID: 137, icon: svgIcon(), name: 'Polygon' },
      { chainID: 146, icon: svgIcon(), name: 'Sonic' },
      { chainID: 999, icon: svgIcon(), name: 'HyperEVM' },
      { chainID: 8453, icon: svgIcon(), name: 'Base' },
      { chainID: 42161, icon: svgIcon(), name: 'Arbitrum One' },
      { chainID: 11155111, icon: svgIcon(), name: 'Ethereum Sepolia testnet' },
    ]);
  });
});
