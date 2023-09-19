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

import { ReactNode, useEffect, useState } from 'react';
import { WCWeb3WalletContext } from './WCWeb3WalletContext';
import { IWeb3Wallet, Web3Wallet } from '@walletconnect/web3wallet';
import { Core } from '@walletconnect/core';
import { getTopicFromURI, pairingHasEverBeenRejected } from '../utils/walletconnect';

type TProps = {
    children: ReactNode;
  }

export const WCWeb3WalletProvider = ({ children }: TProps) => {
  const [web3wallet, setWeb3wallet] = useState<IWeb3Wallet>();
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);

  useEffect(() => {
    if (!isWalletInitialized) {
      const initializeWeb3Wallet = async () => {
        try {
          const core = new Core({
            projectId: '89733df088867a1a1bf644013addd6cc',
          });

          const wallet = await Web3Wallet.init({
            core,
            metadata: {
              name: 'BitBoxApp',
              description: 'BitBoxApp',
              url: 'https://bitbox.swiss',
              icons: ['https://bitbox.swiss/assets/images/logos/dbb-logo.png']
            }
          });

          setWeb3wallet(wallet);
          setIsWalletInitialized(true);
        } catch (err: unknown) {
          console.log('Error for initializing', err);
        }
      };

      if (!isWalletInitialized) {
        initializeWeb3Wallet();
      }
    }
  }, [isWalletInitialized, web3wallet]);


  const pair = async (params: { uri: string }) => {
    if (!web3wallet) {
      return;
    }
    const { uri } = params;
    const topic = getTopicFromURI(uri);
    const hasEverBeenRejected = pairingHasEverBeenRejected(topic, web3wallet);
    if (hasEverBeenRejected) {
      throw new Error('Please use a new URI!');
    }
    await web3wallet?.core.pairing.pair({ uri });
  };


  return (
    <WCWeb3WalletContext.Provider
      value={{
        isWalletInitialized,
        web3wallet,
        pair
      }}>
      {children}
    </WCWeb3WalletContext.Provider>
  );
};

