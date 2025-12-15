// SPDX-License-Identifier: Apache-2.0

import { IWalletKit } from '@reown/walletkit';
import { createContext } from 'react';

type Props = {
  isWalletInitialized: boolean;
  web3wallet?: IWalletKit;
  pair: (params: {
    uri: string;
  }) => Promise<void>;
  initializeWeb3Wallet: () => void;
};

export const WCWeb3WalletContext = createContext<Props>({} as Props);
