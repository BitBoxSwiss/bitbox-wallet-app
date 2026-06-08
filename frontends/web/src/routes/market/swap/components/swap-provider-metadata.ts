// SPDX-License-Identifier: Apache-2.0

import chainflipLogoPNG from './assets/providers/chainflip-logo.png';
import flashnetLogoSVG from './assets/providers/flashnet-logo.svg';
import gardenLogoPNG from './assets/providers/garden-logo.png';
import harborLogoPNG from './assets/providers/harbor-logo.png';
import jupiterLogoPNG from './assets/providers/jupiter-logo.png';
import mayachainLogoPNG from './assets/providers/mayachain-logo.png';
import nearLogoPNG from './assets/providers/near-logo.png';
import okxLogoPNG from './assets/providers/okx-logo.png';
import oneinchLogoPNG from './assets/providers/oneinch-logo.png';
import pancakeswapLogoPNG from './assets/providers/pancakeswap-logo.png';
import sushiswapV2LogoPNG from './assets/providers/sushiswap-v2-logo.png';
import thorchainLogoPNG from './assets/providers/thorchain-logo.png';
import uniswapV2LogoPNG from './assets/providers/uniswap-v2-logo.png';

type TSwapProviderMetadata = {
  displayName: string;
  logo?: string;
};

const SWAP_PROVIDER_METADATA: Readonly<Record<string, TSwapProviderMetadata>> = {
  chainflip: { displayName: 'Chainflip', logo: chainflipLogoPNG },
  flashnet: { displayName: 'FLASHNET', logo: flashnetLogoSVG },
  garden: { displayName: 'Garden', logo: gardenLogoPNG },
  harbor: { displayName: 'Harbor', logo: harborLogoPNG },
  jupiter: { displayName: 'Jupiter', logo: jupiterLogoPNG },
  mayachain: { displayName: 'Mayachain', logo: mayachainLogoPNG },
  mayachain_streaming: { displayName: 'Mayachain', logo: mayachainLogoPNG },
  near: { displayName: 'Near', logo: nearLogoPNG },
  okx: { displayName: 'OKX', logo: okxLogoPNG },
  oneinch: { displayName: '1inch', logo: oneinchLogoPNG },
  pancakeswap: { displayName: 'PancakeSwap', logo: pancakeswapLogoPNG },
  sushiswap_v2: { displayName: 'SushiSwap', logo: sushiswapV2LogoPNG },
  thorchain: { displayName: 'THORChain', logo: thorchainLogoPNG },
  thorchain_streaming: { displayName: 'THORChain', logo: thorchainLogoPNG },
  uniswap_v2: { displayName: 'Uniswap', logo: uniswapV2LogoPNG },
};

export const normalizeProviderName = (name: string) => {
  return name.trim().toLowerCase();
};

export const getSwapProviderMetadata = (name: string): TSwapProviderMetadata => {
  const normalizedName = normalizeProviderName(name);
  const metadata = SWAP_PROVIDER_METADATA[normalizedName];
  if (metadata) {
    return metadata;
  }
  return {
    displayName: name.trim(),
  };
};
