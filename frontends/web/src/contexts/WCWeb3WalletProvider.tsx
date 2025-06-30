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
import { useTranslation } from 'react-i18next';
import { WCWeb3WalletContext } from './WCWeb3WalletContext';
import { IWalletKit } from '@reown/walletkit';
import { getTopicFromURI, pairingHasEverBeenRejected } from '@/utils/walletconnect';
import { useLoad } from '@/hooks/api';
import { getConfig, setConfig } from '@/utils/config';

type TProps = {
  children: ReactNode;
}

export const WCWeb3WalletProvider = ({ children }: TProps) => {
  const { t } = useTranslation();
  const [web3wallet, setWeb3wallet] = useState<IWalletKit>();
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const config = useLoad(getConfig);
  const hasUsedWC = config && config.frontend && config.frontend.hasUsedWalletConnect;

  const initializeWeb3Wallet = async () => {
    try {
      const { Core } = await import('@walletconnect/core');
      const { WalletKit } = await import('@reown/walletkit');

      const core = new Core({
        projectId: '89733df088867a1a1bf644013addd6cc',
      });

      const wallet = await WalletKit.init({
        core,
        metadata: {
          name: 'BitBox',
          description: 'BitBox02 hardware wallet',
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

  useEffect(() => {
    if (
      !web3wallet &&
      !isWalletInitialized &&
      hasUsedWC
    ) {
      initializeWeb3Wallet();
    }
  }, [isWalletInitialized, web3wallet, hasUsedWC]);


  const pair = async (params: { uri: string }) => {
    if (!web3wallet) {
      return;
    }
    try {
      const { uri } = params;
      const topic = getTopicFromURI(uri);
      const hasEverBeenRejected = pairingHasEverBeenRejected(topic, web3wallet);
      if (hasEverBeenRejected) {
        throw new Error(t('walletConnect.useNewUri'));
      }
      await web3wallet?.core.pairing.pair({ uri });
      setConfig({ frontend: { hasUsedWalletConnect: true } });
    } catch (error: any) {
      console.error('Wallet connect attempt to pair error', error);
      if (error?.message?.includes('Pairing already exists')) {
        throw new Error(t('walletConnect.useNewUri'));
      }
      //unexpected error, display native error message
      throw new Error(error.message);
    }
  };


  return (
    <WCWeb3WalletContext.Provider
      value={{
        initializeWeb3Wallet,
        isWalletInitialized,
        web3wallet,
        pair
      }}>
      {children}
    </WCWeb3WalletContext.Provider>
  );
};

