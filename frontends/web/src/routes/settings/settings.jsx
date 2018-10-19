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
import { apiGet } from '../../utils/request';
import { setConfig } from '../../utils/config';
import { ButtonLink, Checkbox } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { FiatSelection } from '../../components/fiat/fiat';
import Header from '../../components/header/Header';
import Footer from '../../components/footer/footer';
import InlineMessage from '../../components/inlineMessage/InlineMessage';

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

    handleDismissMessage = event => {
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
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('settings.title')}</h2>} {...this.props} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                config && (
                                    <div class="flex-1">
                                        <FiatSelection />
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.accounts.title')}</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-row flex-start flex-wrap wrapped">
                                            <div>
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHP2SHActive}
                                                    id="bitcoinP2WPKHP2SHActive"
                                                    onChange={this.handleToggleAccount}
                                                    label={t('settings.accounts.bitcoinP2WPKHP2SH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHActive}
                                                    id="bitcoinP2WPKHActive"
                                                    onChange={this.handleToggleAccount}
                                                    label={t('settings.accounts.bitcoinP2WPKH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2PKHActive}
                                                    id="bitcoinP2PKHActive"
                                                    onChange={this.handleToggleAccount}
                                                    label={t('settings.accounts.bitcoinP2PKH')}
                                                    className="text-medium" />
                                            </div>
                                            <div>
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHP2SHActive}
                                                    id="litecoinP2WPKHP2SHActive"
                                                    onChange={this.handleToggleAccount}
                                                    label={t('settings.accounts.litecoinP2WPKHP2SH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHActive}
                                                    id="litecoinP2WPKHActive"
                                                    onChange={this.handleToggleAccount}
                                                    label={t('settings.accounts.litecoinP2WPKH')}
                                                    className="text-medium" />
                                            </div>
                                        </div>
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.expert.title')}</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-row flex-start flex-items-center flex-wrap wrapped">
                                            <div>
                                                <Checkbox
                                                    checked={config.frontend.coinControl}
                                                    id="coinControl"
                                                    onChange={this.handleToggleCoinControl}
                                                    label={t('settings.expert.coinControl')}
                                                    className="text-medium" />
                                            </div>
                                            <div>
                                                <ButtonLink primary href="/settings/electrum">{t('settings.expert.electrum.title')}</ButtonLink>
                                            </div>
                                        </div>
                                        {
                                            accountSuccess && (
                                                <div class="row">
                                                    <InlineMessage
                                                        type="success"
                                                        align="left"
                                                        message={t('settings.success')}
                                                        onEnd={this.handleDismissMessage} />
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                            }
                            <Footer />
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
