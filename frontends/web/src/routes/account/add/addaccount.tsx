/**
 * Copyright 2018 Shift Devices AG
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

import linkState from 'linkstate';
import { Component, h, JSX, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { alertUser } from '../../../components/alert/Alert';
import { Button, ButtonLink, Input, Select } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';

const COIN_AND_ACCOUNT_CODES = {
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
    'tbtc-addr': {
        name: 'Bitcoin Testnet Address',
        coinCode: 'tbtc',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
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
    'tltc-addr': {
        name: 'Litecoin Testnet Address',
        coinCode: 'tltc',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
    },
    'teth': {
        name: 'Ethereum Ropsten Testnet',
        coinCode: 'teth',
        scriptType: 'p2wpkh', // TODO dummy script type to pass DecodeScriptType
    },
};

interface State {
    coinAndAccountCode: keyof typeof COIN_AND_ACCOUNT_CODES;
    accountName: string;
    extendedPublicKey: string;
    address: string;
}

interface TestingProps {
    testing?: boolean;
}

type Props = TestingProps & TranslateProps;

class AddAccount extends Component<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            coinAndAccountCode: props.testing ? 'tbtc-p2wpkh-p2sh' : 'btc-p2wpkh-p2sh',
            accountName: '',
            extendedPublicKey: '',
            address: '',
        };
    }

    private submit = () => {
        const { coinCode, scriptType } = COIN_AND_ACCOUNT_CODES[this.state.coinAndAccountCode];

        interface ResponseData {
            success: boolean;
            errorCode?: 'xpubInvalid' | 'unknown';
            warningCode?: 'xpubWrongNet' | '';
            accountCode?: string;
            errorMessage?: string;
        }

        apiPost('account-add', {
                coinCode,
                scriptType,
                accountName: this.state.accountName,
                extendedPublicKey: this.state.extendedPublicKey,
                address: this.state.address,
        }).then((data: ResponseData) => {
            if (data.success) {
                if (data.warningCode) {
                    alertUser(this.props.t(`addAccount.warning.${data.warningCode}`));
                }
                route('/account/' + data.accountCode);
            } else {
                if (data.errorCode === 'unknown' && data.errorMessage) {
                    alertUser(this.props.t('unknownError', { errorMessage: data.errorMessage }));
                } else {
                    alertUser(this.props.t(`addAccount.error.${data.errorCode}`));
                }
            }
        });
    }

    public render(
        { t, testing }: RenderableProps<Props>,
        { coinAndAccountCode, accountName, extendedPublicKey, address }: Readonly<State>,
    ): JSX.Element {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('addAccount.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="row">
                                <div class="flex flex-1 flex-row flex-between flex-items-top spaced">
                                    <Input
                                        label={t('addAccount.accountName')}
                                        onInput={linkState(this, 'accountName')}
                                        value={accountName}
                                        id="accountName"
                                        placeholder={t('addAccount.accountName')}
                                    />
                                    <Select
                                        label={t('addAccount.coin')}
                                        options={
                                            (testing
                                                ? ['tbtc-p2wpkh-p2sh', 'tbtc-p2wpkh', 'tbtc-p2pkh', 'tbtc-addr', 'tltc-p2wpkh-p2sh', 'tltc-p2wpkh', 'tltc-addr', 'teth']
                                                : ['btc-p2wpkh-p2sh', 'btc-p2wpkh', 'btc-p2pkh', 'btc-addr', 'ltc-p2wpkh-p2sh', 'ltc-p2wpkh', 'ltc-addr', 'eth']
                                            ).map(item => ({
                                                value: item,
                                                text: COIN_AND_ACCOUNT_CODES[item].name,
                                            }))
                                        }
                                        onInput={linkState(this, 'coinAndAccountCode')}
                                        value={coinAndAccountCode}
                                        id="coinAndAccountCode"
                                    />
                                </div>
                            </div>
                            <div class="row">
                                <Input
                                    label={coinAndAccountCode === 'teth' || coinAndAccountCode === 'eth' || coinAndAccountCode === 'ltc-addr' || coinAndAccountCode === 'btc-addr' || coinAndAccountCode === 'tbtc-addr' || coinAndAccountCode === 'tltc-addr' ? t('addAccount.address') : t('addAccount.extendedPublicKey')}
                                    onInput={coinAndAccountCode === 'teth' || coinAndAccountCode === 'eth' || coinAndAccountCode === 'ltc-addr' || coinAndAccountCode === 'btc-addr' || coinAndAccountCode === 'tbtc-addr' || coinAndAccountCode === 'tltc-addr' ? linkState(this, 'address') : linkState(this, 'extendedPublicKey')}
                                    value={coinAndAccountCode === 'teth' || coinAndAccountCode === 'eth' || coinAndAccountCode === 'ltc-addr' || coinAndAccountCode === 'btc-addr' || coinAndAccountCode === 'tbtc-addr' || coinAndAccountCode === 'tltc-addr' ? address : extendedPublicKey}
                                    id="extendedPublicKey"
                                    placeholder={coinAndAccountCode === 'teth' || coinAndAccountCode === 'eth' || coinAndAccountCode === 'ltc-addr' || coinAndAccountCode === 'btc-addr' || coinAndAccountCode === 'tbtc-addr' || coinAndAccountCode === 'tltc-addr' ? t('addAccount.address') : t('addAccount.extendedPublicKey')}
                                />
                            </div>
                            <div class="row buttons flex flex-row flex-between flex-start">
                                <ButtonLink secondary href="/">
                                    {t('button.back')}
                                </ButtonLink>
                                <Button primary onClick={this.submit} disabled={accountName === ''}>
                                    {t('addAccount.submit')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.accountInfo.xpub" entry={t('guide.accountInfo.xpub')} />
                </Guide>
            </div>
        );
    }
}

const loadHOC = load<TestingProps, TranslateProps>({ testing: 'testing' })(AddAccount);

const HOC = translate()(loadHOC);

export { HOC as AddAccount };
