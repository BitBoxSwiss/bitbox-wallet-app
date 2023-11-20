/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ReactNode, createElement } from 'react';
import { IWeb3Wallet } from '@walletconnect/web3wallet';
import { ArbitrumLogo, BSCLogo, ETHLogo, FantomLogo, OptimismLogo, PolygonLogo } from '../components/icon';

type TSupportedChainDetail = {
  [key: string]: { name: string; icon: ReactNode; }
}

export const SUPPORTED_CHAINS: TSupportedChainDetail = {
  'eip155:1': {
    name: 'Etherum mainnet',
    icon: createElement(ETHLogo)
  },
  'eip155:5': {
    name: 'Ethereum goerli',
    icon: createElement(ETHLogo)
  },
  'eip155:10': {
    name: 'Optimism',
    icon: createElement(OptimismLogo)
  },
  'eip155:56': {
    name: 'Binance smart chain',
    icon: createElement(BSCLogo)
  },
  'eip155:137': {
    name: 'Polygon',
    icon: createElement(PolygonLogo)
  },
  'eip155:250': {
    name: 'Fantom',
    icon: createElement(FantomLogo)
  },
  'eip155:42161': {
    name: 'Arbitrum One',
    icon: createElement(ArbitrumLogo)
  }
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

export const truncateAddress = (address: string) => {
  if (!address) {
    return '';
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
};

export const getTopicFromURI = (wcURI: string) => {
  try {
    // Split the URI by ':' and then by '@', and take the part before the '@'
    return wcURI.split(':')[1].split('@')[0];
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
export const pairingHasEverBeenRejected = (topic: string, web3wallet: IWeb3Wallet) => {
  return web3wallet.core.history.values.findIndex(history =>
    history.topic === topic &&
        history.response &&
        'error' in history.response)
        >= 0;
};

export const rejectMessage = (id: number) => {
  return {
    id,
    jsonrpc: '2.0',
    error: {
      code: 5000,
      message: 'User rejected.'
    }
  };
};

export const decodeEthMessage = (hex: string) => {
  hex = hex.trim();
  if (hex.startsWith('0x')) {
    hex = hex.substring(2);
  }

  // Validate input.
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    console.error('Invalid hex string');
    return null;
  }

  // Create a Uint8Array from the hex string.
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) {
      console.error('Invalid byte in hex string');
      return null;
    }
    bytes[i] = byte;
  }

  // Create a TextDecoder and use it to convert the bytes to a string.
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
};
