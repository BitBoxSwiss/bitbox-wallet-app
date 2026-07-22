// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createElement } from 'react';
import { IWalletKit } from '@reown/walletkit';
import { ArbitrumLogo, OptimismLogo, BaseLogo, ETHLogo } from '@/components/icon';
import { truncateMiddle } from '@/utils/truncate';

type TSupportedChainDetail = {
  [key: string]: { name: string; icon: ReactNode };
};

export const SUPPORTED_CHAINS: TSupportedChainDetail = {
  'eip155:1': {
    name: 'Ethereum mainnet',
    icon: createElement(ETHLogo)
  },
  'eip155:10': {
    name: 'Optimism',
    icon: createElement(OptimismLogo)
  },
  'eip155:8453': {
    name: 'Base',
    icon: createElement(BaseLogo)
  },
  'eip155:42161': {
    name: 'Arbitrum One',
    icon: createElement(ArbitrumLogo)
  },
  'eip155:11155111': {
    name: 'Ethereum Sepolia testnet',
    icon: createElement(ETHLogo)
  },
};

export const EIP155_SIGNING_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN: 'eth_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  /**
     * Many dapps will request an 'eth_signTypedData' but in reality expect 'eth_signTypedData_v4'
     * because that's basically the standard. V4 is assumed, but not necessarily asked for specifically.
     * There aren't many uses of V3 in the wild, but leaving in just in case and returning a v4 signature instead,
     * the dapp can validate this anyway
     */
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction'
};

export const getAddressFromEIPString = (address: string) => {
  const parts = address.split(':');
  return parts.length > 2 ? parts[2] : '';
};

export const truncateAddress = (address: string) =>
  truncateMiddle(address, 6, 6);
export const getTopicFromURI = (wcURI: string) => {
  try {
    // Split the URI by ':'
    const afterColon = wcURI.split(':')[1] || '';
    // return before the '@' or empty string
    return afterColon.split('@')[0] || '';
  } catch {
    return '';
  }
};

// It is necessary to check the history for previously rejected pairing attempts.
// Without this check, a pairing URI that was previously rejected (and thus is invalid)
// might still be paired (for unknown reasons the WC library does this).

// This "invalid pairing" won't request a new session and
// also won't throw any error (on the first attempt) rendering it
// non functional and potentially confuses the user.
export const pairingHasEverBeenRejected = (topic: string, web3wallet: IWalletKit) => {
  return web3wallet.core.history.values.findIndex(history =>
    history.topic === topic &&
        history.response &&
        'error' in history.response)
        >= 0;
};

export const decodeEthMessage = (hex: string) => {
  if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(hex)) {
    return null;
  }

  const message = hex.slice(2);
  const bytes = new Uint8Array(message.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(message.slice(i * 2, i * 2 + 2), 16);
  }

  return new TextDecoder('utf-8').decode(bytes);
};
