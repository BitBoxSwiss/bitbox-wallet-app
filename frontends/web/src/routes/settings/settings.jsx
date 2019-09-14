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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { debug } from '../../utils/env';
import { apiGet } from '../../utils/request';
import { setConfig } from '../../utils/config';
import { ButtonLink, Checkbox } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { FiatSelection } from '../../components/fiat/fiat';
import { Header, Footer } from '../../components/layout';
import { Shift } from '../../components/icon/logo';
import InlineMessage from '../../components/inlineMessage/InlineMessage';
import * as style from '../../components/fiat/fiat.css';

@translate()
export default class Settings extends Component {
    state = {
        accountSuccess: false,
        config: null,
    }

    componentDidMount() {
        apiGet('config').then(config => this.setState({ config }));
    }

    handleToggleAccount = event => {
        setConfig({
            backend: {
                [event.target.id]: event.target.checked
            }
        })
            .then(config => this.setState({ config, accountSuccess: true }));
    }

    handleDismissMessage = () => {
        this.setState({ accountSuccess: false });
    }

    handleToggleCoinControl = event => {
        setConfig({
            frontend: {
                coinControl: event.target.checked
            }
        })
            .then(config => this.setState({ config }));
    }

    render({
        t,
    }, {
        config,
        accountSuccess,
    }) {
        const accountsList = [
            'bitcoinP2PKHActive',
            'bitcoinP2WPKHActive',
            'bitcoinP2WPKHP2SHActive',
            'litecoinP2WPKHActive',
            'litecoinP2WPKHP2SHActive',
        ];
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('settings.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                config && (
                                    <div class="flex-1">
                                        {
                                            accountSuccess && (
                                                <div class="m-bottom-default">
                                                    <InlineMessage
                                                        type="success"
                                                        align="left"
                                                        message={t('settings.success')}
                                                        onEnd={this.handleDismissMessage} />
                                                </div>
                                            )
                                        }
                                        <FiatSelection />
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.accounts.title')}</h3>
                                            </div>
                                        </div>
                                        <div className={style.container}>
                                            <div className={style.left}>
                                                <label className="labelLarge">Avaiable Accounts</label>
                                                <div className={style.content}>
                                                    {
                                                        accountsList.map((account, index) => {
                                                            return !config.backend[account] ? (
                                                                <Checkbox
                                                                    key={`available-account-${index}`}
                                                                    checked={config.backend[account]}
                                                                    id={account}
                                                                    onChange={this.handleToggleAccount}
                                                                    label={t(`settings.accounts.${account.replace('Active', '')}`)}
                                                                    className="text-medium" />
                                                            ) : null
                                                        })
                                                    }
                                                </div>
                                            </div>
                                            <div className={style.right}>
                                                <label className="labelLarge">Active Accounts</label>
                                                <div className={style.content}>
                                                    {
                                                        accountsList.map((account, index) => {
                                                            return config.backend[account] ? (
                                                                <Checkbox
                                                                    key={`available-account-${index}`}
                                                                    checked={config.backend[account]}
                                                                    id={account}
                                                                    onChange={this.handleToggleAccount}
                                                                    label={t(`settings.accounts.${account.replace('Active', '')}`)}
                                                                    className="text-medium" />
                                                            ) : null
                                                        })
                                                    }
                                                    {
                                                        debug && (
                                                            <Checkbox
                                                                checked={config.backend.ethereumActive}
                                                                id="ethereumActive"
                                                                onChange={this.handleToggleAccount}
                                                                label="Ethereum"
                                                                className="text-medium" />
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.expert.title')}</h3>
                                            </div>
                                        </div>
                                        <div class={style.content}>
                                            <Checkbox
                                                checked={config.frontend.coinControl}
                                                id="coinControl"
                                                onChange={this.handleToggleCoinControl}
                                                label={t('settings.expert.coinControl')}
                                                className="text-medium" />
                                        </div>
                                        <div class="row extra">
                                            <ButtonLink primary href="/settings/electrum">{t('settings.expert.electrum.title')}</ButtonLink>
                                        </div>
                                    </div>
                                )
                            }
                            <hr />
                            <Footer>
                                <Shift />
                            </Footer>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.settings.whyMultipleAccounts" entry={t('guide.settings.whyMultipleAccounts')} />
                    <Entry key="guide.settings.btc-p2pkh" entry={t('guide.settings.btc-p2pkh')} />
                    <Entry key="guide.settings.btc-p2sh" entry={t('guide.settings.btc-p2sh')} />
                    <Entry key="guide.settings.btc-p2wpkh" entry={t('guide.settings.btc-p2wpkh')} />
                    <Entry key="guide.settings.servers" entry={t('guide.settings.servers')} />
                    <Entry key="guide.settings.moreCoins" entry={t('guide.settings.moreCoins')} />
                </Guide>
            </div>
        );
    }
}
