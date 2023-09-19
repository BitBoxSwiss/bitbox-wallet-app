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
import { createContext } from 'react';

type Props = {
    isWalletInitialized: boolean;
    web3wallet?: IWeb3Wallet;
    pair: (params: {
        uri: string;
    }) => Promise<void>;
}

export const WCWeb3WalletContext = createContext<Props>({} as Props);