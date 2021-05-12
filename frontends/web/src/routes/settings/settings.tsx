/**
 * Copyright 2018 Shift Devices AG
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

import { Component, h, RenderableProps } from 'preact';
import { IAccount } from '../../api/account';
import { Link, route } from 'preact-router';
import { alertUser } from '../../components/alert/Alert';
import { Badge } from '../../components/badge/badge';
import { Dialog } from '../../components/dialog/dialog';
import * as dialogStyle from '../../components/dialog/dialog.css';
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
import { FiatSelection } from './components/fiat/fiat';
import * as style from './settings.css';

interface SettingsProps {
    accounts: IAccount[];
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

    private handleToggleFrontendSetting = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        setConfig({
            frontend: {
                [target.id]: target.checked,
            },
        })
            .then(config => this.setState({ config }));
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
            this.setState({
                config,
                proxyAddress: proxyConfig.proxyAddress,
                restart: true,
            });
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
        if (!config || this.state.proxyAddress === undefined) {
            return;
        }
        const proxy = config.backend.proxy;
        proxy.proxyAddress = this.state.proxyAddress.trim();
        apiPost('socksproxy/check', proxy.proxyAddress).then(({ success, errorMessage }) => {
            if (success) {
                this.setProxyConfig(proxy);
            } else {
                alertUser(errorMessage);
            }
        });
    }

    private showProxyDialog = () => {
        this.setState({ activeProxyDialog: true });
    }

    private hideProxyDialog = () => {
        this.setState({ activeProxyDialog: false });
    }

    private handleRestartDismissMessage = () => {
        this.setState({ restart: false });
    }

    private backHome = () => {
        route('/', true);
    }

    public render({
        accounts,
        deviceIDs,
        t,
    }: RenderableProps<Props>,
    {
        config,
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
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
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
                        <div class="content padded-lgscreen">
                            {
                                config && (
                                    <div class="flex-1">
                                        <div className="columnsContainer">
                                            <div className="columns">
                                                <div className="column column-1-3">
                                                    <FiatSelection />
                                                </div>
                                                <div className="column column-2-3">
                                                    { accounts.length ? (
                                                        <div>
                                                            <div class="subHeaderContainer">
                                                                <div class="subHeader">
                                                                    <h3>Accounts</h3>
                                                                </div>
                                                            </div>
                                                            <div className="box slim divide m-bottom-large">
                                                                <SettingsButton
                                                                    onClick={() => route('/settings/manage-accounts', true)}
                                                                    secondaryText="Add and activate/deactivate accounts"
                                                                    optionalText={accounts.length.toString()}>
                                                                    Manage accounts
                                                                </SettingsButton>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    <div class="subHeaderContainer">
                                                        <div class="subHeader">
                                                            <h3>{t('settings.expert.title')}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="box slim divide">
                                                        <div className={style.setting}>
                                                            <div>
                                                                <p className="m-none">{t('settings.expert.fee')}</p>
                                                                <p className="m-none">
                                                                    <Badge type="generic">BTC</Badge>
                                                                    <Badge type="generic" className="m-left-quarter">LTC</Badge>
                                                                </p>
                                                            </div>
                                                            <Toggle
                                                                checked={config.frontend.expertFee}
                                                                id="expertFee"
                                                                onChange={this.handleToggleFrontendSetting} />
                                                        </div>
                                                        <div className={style.setting}>
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
                                                                onChange={this.handleToggleFrontendSetting} />
                                                        </div>
                                                        <SettingsButton
                                                            onClick={this.showProxyDialog}
                                                            optionalText={t('generic.enabled', { context: config.backend.proxy.useProxy.toString() })}>
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
                    <Entry key="guide.settings.servers" entry={t('guide.settings.servers')} />
                    <Entry key="guide.settings-electrum.why" entry={t('guide.settings-electrum.why')} />
                    <Entry key="guide.accountRates" entry={t('guide.accountRates')} />
                    <Entry key="guide.settings-electrum.tor" entry={t('guide.settings-electrum.tor')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<SettingsProps>()(Settings);
export { HOC as Settings };
