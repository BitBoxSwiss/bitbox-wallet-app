/**
 * Copyright 2021 Shift Crypto AG
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

import { apiGet, apiPost } from '../utils/request';
import { Fiat } from './account';

interface ElectrumServer {
    server: string
    tls: boolean
    pemCert: string
}

interface BtcLikeConfig {
    electrumServers: ElectrumServer[]
}

interface EthLikeConfig {
    activeERC20Tokens: []
}

export interface Config {
    backend: {
        proxy: {
            useProxy: boolean
            proxyAddress: string
        }
        bitcoinActive: boolean
        litecoinActive: boolean
        ethereumActive: boolean
        btc?: BtcLikeConfig
        rbtc?: BtcLikeConfig
        tbtc?: BtcLikeConfig
        ltc?: BtcLikeConfig
        tltc?: BtcLikeConfig
        eth: EthLikeConfig
        teth: EthLikeConfig
        reth: EthLikeConfig
        fiatList: Fiat[]
        mainFiat: Fiat,
        userLanguage: string
    }
    frontend: {[key: string]: boolean}
}

export const getConfig = (): Promise<Config> => {
    return apiGet('config');
};

export const setConfig = (newConfig: Config): Promise<void> => {
    return apiPost('config', newConfig);
};
