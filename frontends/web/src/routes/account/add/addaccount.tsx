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
import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { alertUser } from '../../../components/alert/Alert';
import { Button, ButtonLink, Input, Select } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import Header from '../../../components/header/Header';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';

interface State {
    coinCode: string;
    scriptType: string;
    accountName: string;
    extendedPublicKey: string;
}

class AddAccount extends Component<TranslateProps, State> {
    constructor(props: TranslateProps) {
        super(props);

        this.state = {
            coinCode: 'tbtc',
            scriptType: 'p2wpkh-p2sh',
            accountName: '',
            extendedPublicKey: '',
        };
    }

    private submit = () => {
        const body = {
            coinCode: this.state.coinCode,
            scriptType: this.state.scriptType,
            accountName: this.state.accountName,
            extendedPublicKey: this.state.extendedPublicKey,
        };
        interface ResponseData {
            success: boolean;
            errorCode?: 'xpubInvalid' | 'xpubWrongNet';
            accountCode?: string;
        }
        apiPost('account-add', body).then((data: ResponseData) => {
            if (data.success) {
                route('/account/' + data.accountCode);
            } else {
                alertUser(this.props.t(`addAccount.error.${data.errorCode}`));
            }
        });
    }

    public render(
        { t, ...other }: RenderableProps<TranslateProps>,
        { coinCode, scriptType, accountName, extendedPublicKey }: Readonly<State>,
    ): JSX.Element {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('addAccount.title')}</h2>} {...other}  />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="row">
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                    <Input
                                        label={t('addAccount.accountName')}
                                        onInput={linkState(this, 'accountName')}
                                        value={accountName}
                                        id="accountName"
                                        placeholder={t('addAccount.accountName')}
                                    />
                                    <Select
                                        label={t('addAccount.coin')}
                                        options={['btc', 'tbtc', 'ltc', 'tltc', 'eth', 'teth'].map(coin => {
                                            return {
                                                value: coin,
                                                text: coin.toUpperCase(),
                                            };
                                        })}
                                        onInput={linkState(this, 'coinCode')}
                                        value={coinCode}
                                        id="coinCode"
                                    />
                                    <Select
                                        label={t('addAccount.scriptType')}
                                        options={['p2wpkh-p2sh', 'p2wpkh', 'p2pkh'].map(type => {
                                            return {
                                                value: type,
                                                text: type.toUpperCase(),
                                            };
                                        })}
                                        onInput={linkState(this, 'scriptType')}
                                        value={scriptType}
                                        id="scriptType"
                                    />
                                </div>
                            </div>
                            <div class="row">
                                <Input
                                    label={t('addAccount.extendedPublicKey')}
                                    onInput={linkState(this, 'extendedPublicKey')}
                                    value={extendedPublicKey}
                                    id="extendedPublicKey"
                                    placeholder={t('addAccount.extendedPublicKey')}
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

const HOC = translate()(AddAccount);

export { HOC as AddAccount };
