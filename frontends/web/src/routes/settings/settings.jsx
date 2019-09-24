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
import { apiGet, apiPost } from '../../utils/request';
import { setConfig } from '../../utils/config';
import { Badge } from '../../components/badge/badge';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { FiatSelection } from '../../components/fiat/fiat';
import { Header, Footer } from '../../components/layout';
import { SwissMadeOpenSource } from '../../components/icon/logo';
import { Toggle } from '../../components/toggle/toggle';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import * as style from '../../components/fiat/fiat.css';

@translate()
export default class Settings extends Component {
    erc20TokenCodes = {
        usdt: 'Tether USD',
        link: 'Chainlink',
        bat: 'Basic Attention Token',
        mkr: 'Maker',
        zrx: '0x',
        dai: 'Dai',
    }

    state = {
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
            .then(config => {
                this.setState({ config });
                this.reinitializeAccounts();
            });
    }

    handleToggleCoinControl = event => {
        setConfig({
            frontend: {
                coinControl: event.target.checked
            }
        })
            .then(config => this.setState({ config }));
    }

    reinitializeAccounts = () => {
        apiPost('accounts/reinitialize');
    }

    handleToggleEthereum = event => {
        setConfig({
            backend: {
                ethereumActive: event.target.checked
            }
        })
            .then(config => {
                this.setState({ config });
                this.reinitializeAccounts();
            });
    }

    handleToggleERC20Token = event => {
        let config = this.state.config;
        if (!config || !config.backend.eth) {
            return;
        }
        const tokenCode = event.target.dataset.tokencode;
        let eth = config.backend.eth;
        let activeTokens = eth.activeERC20Tokens.filter(val => val !== tokenCode);
        if (event.target.checked) {
            activeTokens.push(tokenCode);
        }
        eth.activeERC20Tokens = activeTokens;
        setConfig({
            backend: { eth }
        })
            .then(config => {
                this.setState({ config });
                this.reinitializeAccounts();
            });
    }

    render({
        t,
    }, {
        config,
    }) {
        const accountsList = [
            {
                name: 'bitcoinP2PKHActive',
                badges: ['BB01'],
            },
            {
                name: 'bitcoinP2WPKHActive',
                badges: ['BB01', 'BB02', 'BB02-BTC'],
            },
            {
                name: 'bitcoinP2WPKHP2SHActive',
                badges: ['BB01', 'BB02', 'BB02-BTC'],
            },
            {
                name: 'litecoinP2WPKHActive',
                badges: ['BB01', 'BB02'],
            },
            {
                name: 'litecoinP2WPKHP2SHActive',
                badges: ['BB01', 'BB02'],
            },
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
                                        <div className="columnsContainer">
                                            <div className="columns">
                                                <div className="column column-1-3">
                                                    <FiatSelection />
                                                </div>
                                                <div className="column column-1-3">
                                                    <div class="subHeaderContainer">
                                                        <div class="subHeader">
                                                            <h3>{t('settings.accounts.title')}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="box slim">
                                                        {
                                                            accountsList.map((account, index) => (
                                                                <div className={style.currency} key={`available-fiat-${index}`}>
                                                                    <div>
                                                                        <p className="m-none">{t(`settings.accounts.${account.name.replace('Active', '')}`)}</p>
                                                                        <p className="m-none">
                                                                            {
                                                                                account.badges.map((badge, i) => (
                                                                                    <Badge
                                                                                        key={`badge-${i}`}
                                                                                        type={badge.includes('BTC') ? 'secondary' : 'primary'}
                                                                                        className={i > 0 ? 'm-left-quarter': ''}>
                                                                                        {badge}
                                                                                    </Badge>
                                                                                ))
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                    <Toggle
                                                                        id={account.name}
                                                                        checked={config.backend[account.name]}
                                                                        onChange={this.handleToggleAccount} />
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                                <div className="column column-1-3">
                                                    <div class="subHeaderContainer withToggler">
                                                        <div class="subHeader">
                                                            <h3>{t('settings.accounts.ethereum')}</h3>
                                                            <Badge type="primary" className="m-left-quarter">BB02</Badge>
                                                        </div>
                                                        <div className="subHeaderToggler">
                                                            <Toggle
                                                                checked={config.backend.ethereumActive}
                                                                id="ethereumActive"
                                                                onChange={this.handleToggleEthereum} />
                                                        </div>
                                                    </div>
                                                    <div className="box slim">
                                                        {
                                                            Object.entries(this.erc20TokenCodes).map(([tokenCode, tokenName]) => (
                                                                <div className={[style.currency, !config.backend.ethereumActive ? style.disabled : ''].join(' ')} key={tokenCode}>
                                                                    <p className="m-none">{tokenName}</p>
                                                                    <Toggle
                                                                        checked={config.backend.eth.activeERC20Tokens.indexOf(tokenCode) > -1}
                                                                        disabled={!config.backend.ethereumActive}
                                                                        id={'erc20-' + tokenCode}
                                                                        data-tokencode={tokenCode}
                                                                        onChange={this.handleToggleERC20Token} />
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                    <p className="text-gray text-small">powered by Etherscan.io APIs</p>
                                                </div>
                                                <div className="column column-1-3">
                                                    <div class="subHeaderContainer">
                                                        <div class="subHeader">
                                                            <h3>{t('settings.expert.title')}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="box slim divide">
                                                        <div className={style.currency}>
                                                            <div>
                                                                <p className="m-none">{t('settings.expert.coinControl')}</p>
                                                                <p className="m-none">
                                                                    <Badge type="generic">BTC</Badge>
                                                                    <Badge type="generic" className="m-left-quarter">LTC</Badge>
                                                                </p>
                                                            </div>
                                                            <Toggle
                                                                checked={config.frontend.coinControl}
                                                                id="coinControl"
                                                                onChange={this.handleToggleCoinControl} />
                                                        </div>
                                                        <SettingsButton link href="/settings/electrum">{t('settings.expert.electrum.title')}</SettingsButton>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                        <Footer>
                            <SwissMadeOpenSource />
                        </Footer>
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
