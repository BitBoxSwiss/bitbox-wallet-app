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

import { h, RenderableProps } from 'preact';
import * as accountApi from '../../../../api/account';
import { Select } from '../../../../components/forms';
import { translate, TranslateProps } from '../../../../decorators/translate';

// copied over from old addacconut.tsx
const COIN_AND_ACCOUNT_CODES = {
    'btc': {
        name: 'Bitcoin',
        coinCode: 'btc',
    },
    // TODO: what about those?
    'btc-p2wpkh-p2sh': {
        name: 'Bitcoin',
        coinCode: 'btc',
        scriptType: 'p2wpkh-p2sh',
    },
    'btc-p2wpkh': {
        name: 'Bitcoin: bech32',
        coinCode: 'btc',
        scriptType: 'p2wpkh',
    },
    'btc-p2pkh': {
        name: 'Bitcoin Legacy',
        coinCode: 'btc',
        scriptType: 'p2pkh',
    },
    'btc-addr': {
        name: 'Bitcoin Address',
        coinCode: 'btc',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
    },
    'ltc': {
        name: 'Litecoin',
        coinCode: 'ltc',
    },
    'ltc-p2wpkh-p2sh': {
        name: 'Litecoin',
        coinCode: 'ltc',
        scriptType: 'p2wpkh-p2sh',
    },
    'ltc-p2wpkh': {
        name: 'Litecoin: bech32',
        coinCode: 'ltc',
        scriptType: 'p2wpkh',
    },
    'ltc-addr': {
        name: 'Litecoin Address',
        coinCode: 'ltc',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
    },
    'eth': {
        name: 'Ethereum',
        coinCode: 'eth',
        scriptType: 'p2wpkh',
    },
    // Testnet
    'tbtc': {
        name: 'Bitcoin Testnet',
        coinCode: 'tbtc',
    },
    'tbtc-p2wpkh-p2sh': {
        name: 'Bitcoin Testnet',
        coinCode: 'tbtc',
        scriptType: 'p2wpkh-p2sh',
    },
    'tbtc-p2wpkh': {
        name: 'Bitcoin Testnet: bech32',
        coinCode: 'tbtc',
        scriptType: 'p2wpkh',
    },
    'tbtc-p2pkh': {
        name: 'Bitcoin Testnet Legacy',
        coinCode: 'tbtc',
        scriptType: 'p2pkh',
    },
    'tltc': {
        name: 'Litecoin Testnet',
        coinCode: 'tltc',
    },
    'tltc-p2wpkh-p2sh': {
        name: 'Litecoin Testnet',
        coinCode: 'tltc',
        scriptType: 'p2wpkh-p2sh',
    },
    'tltc-p2wpkh': {
        name: 'Litecoin Testnet: bech32',
        coinCode: 'tltc',
        scriptType: 'p2wpkh',
    },
    'teth': {
        name: 'Ethereum Ropsten Testnet',
        coinCode: 'teth',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
    },
};

interface CoinDropDownProps {
    onChange: (coin: accountApi.CoinCode) => void;
    supportedCoins: string[];
    value: string;
}

type Props = CoinDropDownProps & TranslateProps;

function CoinDropDown({
    onChange,
    supportedCoins,
    t,
    value,
}: RenderableProps<Props>) {
    return (
        <Select
            options={[
                {
                    text: t('buy.info.selectPlaceholder'),
                    disabled: true,
                    value: 'choose',
                },
                ...(supportedCoins).map(item => ({
                    value: item,
                    text: COIN_AND_ACCOUNT_CODES[item].name,
                }))
            ]}
            onInput={e => onChange(e.target.value)}
            defaultValue={'choose'}
            placeholder={t('buy.info.selectPlaceholder')}
            value={value}
            id="coinCodeDropDown" />
    );
}

const HOC = translate<CoinDropDownProps>()(CoinDropDown);

export { HOC as CoinDropDown };
