// SPDX-License-Identifier: Apache-2.0

import arbitrumIcon from '@/components/icon/assets/arbitrum-color.svg';
import baseIcon from '@/components/icon/assets/base-color.svg';
import bnbChainIcon from '@/components/icon/assets/bnb-chain-color.svg';
import ethereumIcon from '@/components/icon/assets/eth-color.svg';
import gnosisIcon from '@/components/icon/assets/gnosis-color.svg';
import hyperEVMIcon from '@/components/icon/assets/hyperevm-color.svg';
import optimismIcon from '@/components/icon/assets/optimism-color.svg';
import polygonIcon from '@/components/icon/assets/polygon-color.svg';
import sonicIcon from '@/components/icon/assets/sonic-color.svg';

export type TEVMChain = {
  icon: string;
  name: string;
};

export const EVM_CHAIN_REGISTRY: Record<number, TEVMChain> = {
  1: {
    icon: ethereumIcon,
    name: 'Ethereum mainnet',
  },
  10: {
    icon: optimismIcon,
    name: 'Optimism',
  },
  56: {
    icon: bnbChainIcon,
    name: 'BNB Smart Chain',
  },
  100: {
    icon: gnosisIcon,
    name: 'Gnosis',
  },
  137: {
    icon: polygonIcon,
    name: 'Polygon',
  },
  146: {
    icon: sonicIcon,
    name: 'Sonic',
  },
  999: {
    icon: hyperEVMIcon,
    name: 'HyperEVM',
  },
  8453: {
    icon: baseIcon,
    name: 'Base',
  },
  42161: {
    icon: arbitrumIcon,
    name: 'Arbitrum One',
  },
  11155111: {
    icon: ethereumIcon,
    name: 'Ethereum Sepolia testnet',
  },
};
