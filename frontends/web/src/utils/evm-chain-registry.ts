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
  nameKey: string;
};

export const EVM_CHAIN_REGISTRY: Record<number, TEVMChain> = {
  1: {
    icon: ethereumIcon,
    nameKey: 'evmChains.ethereumMainnet',
  },
  10: {
    icon: optimismIcon,
    nameKey: 'evmChains.optimism',
  },
  56: {
    icon: bnbChainIcon,
    nameKey: 'evmChains.bnbSmartChain',
  },
  100: {
    icon: gnosisIcon,
    nameKey: 'evmChains.gnosis',
  },
  137: {
    icon: polygonIcon,
    nameKey: 'evmChains.polygon',
  },
  146: {
    icon: sonicIcon,
    nameKey: 'evmChains.sonic',
  },
  999: {
    icon: hyperEVMIcon,
    nameKey: 'evmChains.hyperEVM',
  },
  8453: {
    icon: baseIcon,
    nameKey: 'evmChains.base',
  },
  42161: {
    icon: arbitrumIcon,
    nameKey: 'evmChains.arbitrumOne',
  },
  11155111: {
    icon: ethereumIcon,
    nameKey: 'evmChains.ethereumSepoliaTestnet',
  },
};
