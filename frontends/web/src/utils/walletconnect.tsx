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


import { IWeb3Wallet } from '@walletconnect/web3wallet';


export const SUPPORTED_CHAINS = [
  'eip155:1', // ETH Mainnet
  'eip155:5', // ETH Goerli testnet
  'eip155:10', // Optimism
  'eip155:56', // BSC
  'eip155:137', // Polygon
  'eip155:250', // Fantom
  'eip155:42161' // Arbitrum One
];

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