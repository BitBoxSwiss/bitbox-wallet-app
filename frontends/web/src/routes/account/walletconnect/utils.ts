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

import { Core } from '@walletconnect/core';
import { IWeb3Wallet, Web3Wallet } from '@walletconnect/web3wallet';
import { useCallback, useEffect, useState } from 'react';

export let web3wallet: IWeb3Wallet;

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

// Initialize the Web3Wallet
export default function useInitialization() {
  const [initialized, setInitialized] = useState(false);
  const onInitialize = useCallback(async () => {
    try {
      await createWeb3Wallet();
      setInitialized(true);
    } catch (err: unknown) {
      console.log('Error for initializing', err);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      onInitialize();
    }
  }, [onInitialize, initialized]);

  return initialized;
}


export async function createWeb3Wallet() {
  const core = new Core({
    projectId: '89733df088867a1a1bf644013addd6cc',
  });

  web3wallet = await Web3Wallet.init({
    core,
    metadata: {
      name: 'BitBoxApp',
      description: 'BitBoxApp',
      url: 'https://bitbox.swiss',
      // TODO: Add BitBox logo
      icons: []
    }
  });
}

export async function pair(params: { uri: string }) {
  return await web3wallet?.core.pairing.pair({ uri: params.uri });
}