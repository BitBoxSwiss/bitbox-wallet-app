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

import { Component, h, RenderableProps } from 'preact';
import { Link, route } from 'preact-router';
import { Badge } from '../../components/badge/badge';
import { Dialog } from '../../components/dialog/dialog';
import * as dialogStyle from '../../components/dialog/dialog.css';
import { FiatSelection } from '../../components/fiat/fiat';
import * as style from '../../components/fiat/fiat.css';
import { Button, Input } from '../../components/forms';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { SwissMadeOpenSource } from '../../components/icon/logo';
import InlineMessage from '../../components/inlineMessage/InlineMessage';
import { Footer, Header } from '../../components/layout';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import { Toggle } from '../../components/toggle/toggle';
import { translate, TranslateProps } from '../../decorators/translate';
import { setConfig } from '../../utils/config';
import { debug } from '../../utils/env';
import { apiGet, apiPost } from '../../utils/request';

interface SettingsProps {
    deviceIDs: string[];
}

type Props = SettingsProps & TranslateProps;

interface State {
    restart: boolean;
    config: any;
    proxyAddress?: string;
    activeProxyDialog: boolean;
}

class Settings extends Component<Props, State> {
    private accountsList = [
        { name: 'bitcoinActive',
          label: 'Bitcoin',
          badges: ['BB01', 'BB02', 'BB02-BTC'],
        },
        { name: 'litecoinActive',
          label: 'Litecoin',
          badges: ['BB01', 'BB02'],
        },
    ];

    private erc20TokenCodes = {
        usdt: 'Tether USD',
        usdc: 'USD Coin',
        link: 'Chainlink',
        bat: 'Basic Attention Token',
        mkr: 'Maker',
        zrx: '0x',
        sai0x89d2: 'Sai',
        dai0x6b17: 'Dai',
    };

    constructor(props) {
        super(props);
        this.state = {
            restart: false,
            config: null,
            proxyAddress: undefined,
            activeProxyDialog: false,
        };
    }

    public componentDidMount() {
        apiGet('config').then(config => {
            this.setState({ config, proxyAddress: config.backend.proxy.proxyAddress });
        });
    }

    public componentDidUpdate(prevProps) {
        if (prevProps.deviceIDs.length && !this.props.deviceIDs.length) {
            route('/', true);
        }
    }

    private handleToggleAccount = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        setConfig({
            backend: {
                [target.id]: target.checked,
            },
        })
            .then(config => {
                this.setState({ config });
                this.reinitializeAccounts();
            });
    }

    private handleToggleCoinControl = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        setConfig({
            frontend: {
                coinControl: target.checked,
            },
        })
            .then(config => this.setState({ config }));
    }

    private reinitializeAccounts = () => {
        apiPost('accounts/reinitialize');
    }

    private handleToggleEthereum = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        setConfig({
            backend: {
                ethereumActive: target.checked,
            },
        })
            .then(config => {
                this.setState({ config });
                this.reinitializeAccounts();
            });
    }

    private handleToggleERC20Token = (event: Event) => {
        const config = this.state.config;
        if (!config || !config.backend.eth) {
            return;
        }
        const target = (event.target as HTMLInputElement);
        const tokenCode = target.dataset.tokencode;
        const eth = config.backend.eth;
        const activeTokens = eth.activeERC20Tokens.filter(val => val !== tokenCode);
        if (target.checked) {
            activeTokens.push(tokenCode);
        }
        eth.activeERC20Tokens = activeTokens;
        setConfig({
            backend: { eth },
        })
            .then(newConfig => {
                this.setState({ config: newConfig });
                this.reinitializeAccounts();
            });
    }

    private handleFormChange = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        if (target.name !== 'proxyAddress') {
            return;
        }
        this.setState({
            [target.name]: target.value,
            restart: false,
        });
    }

    private setProxyConfig = proxyConfig => {
        setConfig({
            backend: { proxy: proxyConfig },
        }).then(config => {
            this.setState({ config, restart: true });
        });
    }

    private handleToggleProxy = (event: Event) => {
        const config = this.state.config;
        if (!config) {
            return;
        }
        const target = (event.target as HTMLInputElement);
        const proxy = config.backend.proxy;
        proxy.useProxy = target.checked;
        this.setProxyConfig(proxy);
    }

    private setProxyAddress = () => {
        const config = this.state.config;
        if (!config) {
            return;
        }
        const proxy = config.backend.proxy;
        proxy.proxyAddress = this.state.proxyAddress;
        this.setProxyConfig(proxy);
    }

    private showProxyDialog = () => {
        this.setState({ activeProxyDialog: true });
    }

    private hideProxyDialog = () => {
        this.setState({ activeProxyDialog: false });
    }

    /*
    private setServicesConfig = servicesConfig => {
        setConfig({
            backend: { services: servicesConfig },
        }).then(config => {
            this.setState({ config });
        });
    }

    private handleToggleSafello = (event: Event) => {
        const config = this.state.config;
        if (!config) {
            return;
        }
        const target = (event.target as HTMLInputElement);
        const services = config.backend.services;
        services.safello = target.checked;
        this.setServicesConfig(services);
    }
    */

    private handleRestartDismissMessage = () => {
        this.setState({ restart: false });
    }

    private backHome = () => {
        route('/', true);
    }

    public render(
        { t, deviceIDs }: RenderableProps<Props>,
        { config,
            restart,
            proxyAddress,
            activeProxyDialog }: State,
    ) {
        if (proxyAddress === undefined) {
            return null;
        }

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('settings.title')}</h2>}>
                        {
                            !deviceIDs.length && (
                                <Link onClick={this.backHome} className="flex flex-row flex-items-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        className="m-right-tiny">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                    </svg>
                                    {t('settings.header.home')}
                                </Link>
                            )
                        }
                    </Header>
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
                                                            this.accountsList.map((account, index) => (
                                                                <div className={style.currency} key={`available-fiat-${index}`}>
                                                                    <div>
                                                                        <p className="m-none">{account.label}</p>
                                                                        <p className="m-none">
                                                                            {
                                                                                account.badges.map((badge, i) => (
                                                                                    <Badge
                                                                                        key={`badge-${i}`}
                                                                                        type={badge.includes('BTC') ? 'secondary' : 'primary'}
                                                                                        className={i > 0 ? 'm-left-quarter' : ''}>
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
                                                        <SettingsButton
                                                            onClick={this.showProxyDialog}
                                                             optionalText={t('generic.enabled', {context: config.backend.proxy.useProxy.toString()})}>
                                                            {t('settings.expert.useProxy')}
                                                        </SettingsButton>
                                                        {
                                                            activeProxyDialog && (
                                                                <Dialog onClose={this.hideProxyDialog} title={t('settings.expert.setProxyAddress')} small>
                                                                    <div className="flex flex-row flex-between flex-items-center">
                                                                        <div>
                                                                            <p className="m-none">{t('settings.expert.useProxy')}</p>
                                                                        </div>
                                                                        <Toggle
                                                                            id="useProxy"
                                                                            checked={config.backend.proxy.useProxy}
                                                                            onChange={this.handleToggleProxy} />
                                                                    </div>
                                                                    <div className="m-top-half">
                                                                        <Input
                                                                            name="proxyAddress"
                                                                            onInput={this.handleFormChange}
                                                                            value={proxyAddress}
                                                                            placeholder="127.0.0.1:9050"
                                                                            disabled={!config.backend.proxy.useProxy}
                                                                        />
                                                                        <div className={dialogStyle.actions}>
                                                                            <Button primary
                                                                                onClick={this.setProxyAddress}
                                                                                disabled={!config.backend.proxy.useProxy || proxyAddress === config.backend.proxy.proxyAddress}>
                                                                                {t('settings.expert.setProxyAddress')}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </Dialog>
                                                            )
                                                        }
                                                        <SettingsButton link href="/settings/electrum">{t('settings.expert.electrum.title')}</SettingsButton>
                                                        {
                                                            debug && <SettingsButton link href="/bitboxbase">{t('settings.expert.base')}</SettingsButton>
                                                        }
                                                    </div>
                                                </div>

                                                {/* Safello suspended services, maybe temporarily, so we keep this around for a bit.
                                                <div className="column column-1-3">
                                                    <div class="subHeaderContainer">
                                                        <div class="subHeader">
                                                            <h3>{t('settings.services.title')}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="box slim divide">
                                                        <div className={style.currency}>
                                                            <div>
                                                                <p className="m-none">Safello</p>
                                                                <p className="m-none">
                                                                    <Badge type="generic">BTC</Badge>
                                                                </p>
                                                            </div>
                                                            <Toggle
                                                                checked={config.backend.services.safello}
                                                                id="safello"
                                                                onChange={this.handleToggleSafello} />
                                                        </div>

                                                    </div>
                                                </div>
                                                */}
                                            </div>
                                            {
                                                restart && (
                                                    <div class="row">
                                                        <InlineMessage
                                                            type="success"
                                                            align="left"
                                                            message={t('settings.restart')}
                                                            onEnd={this.handleRestartDismissMessage} />
                                                    </div>
                                                )
                                            }
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
                    <Entry key="guide.accountRates" entry={t('guide.accountRates')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<SettingsProps>()(Settings);
export { HOC as Settings };
