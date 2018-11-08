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

import { h, RenderableProps } from 'preact';
import { Button, Input, Select } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import Header from '../../../components/header/Header';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';

function submit() {
    const body = {
        coinCode: (document.getElementById('coinCode') as HTMLSelectElement).value,
        scriptType: (document.getElementById('scriptType') as HTMLSelectElement).value,
        accountName: (document.getElementById('accountName') as HTMLInputElement).value,
        extendedPublicKey: (document.getElementById('extendedPublicKey') as HTMLInputElement).value,
    };
    apiPost('account/add', body);
}

function AddAccount({ t }: RenderableProps<TranslateProps>): JSX.Element {
    return (
        <div class="contentWithGuide">
            <div class="container">
                <Header title={<h2>{t('addAccount.title')}</h2>} />
                <div class="innerContainer scrollableContainer">
                    <div class="content padded">
                        <div class="row">
                            <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                <Select
                                    label={t('addAccount.coin')}
                                    id="coinCode"
                                    options={['btc', 'tbtc', 'ltc', 'tltc', 'eth', 'teth'].map(coin => {
                                        return {
                                            value: coin,
                                            text: coin.toUpperCase(),
                                        };
                                    })}
                                />
                                <Select
                                    label={t('addAccount.scriptType')}
                                    id="scriptType"
                                    options={['p2wpkh-p2sh', 'p2wpkh', 'p2pkh'].map(scriptType => {
                                        return {
                                            value: scriptType,
                                            text: scriptType.toUpperCase(),
                                        };
                                    })}
                                />
                                <Input
                                    label={t('addAccount.accountName')}
                                    id="accountName"
                                />
                            </div>
                        </div>
                        <div class="row">
                            <Input
                                label={t('addAccount.extendedPublicKey')}
                                id="extendedPublicKey"
                            />
                        </div>
                        <div class="row buttons flex flex-row flex-between flex-start">
                            <Button primary onClick={submit}>
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

const HOC = translate()(AddAccount);

export { HOC as AddAccount };
