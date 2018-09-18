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
import { Guide } from '../../components/guide/guide';
import { ButtonLink, Button, Input } from '../../components/forms';
import { apiGet, apiPost } from '../../utils/request';
import * as style from './settings.css';

@translate()
class ElectrumServer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            valid: false,
            electrumServer: '',
            electrumCert: '',
            loadingCheck: false,
            loadingCert: false,
        };
        if (props.server !== null) {
            this.setState({
                electrumServer: props.server.server,
                electrumCert: props.server.pemCert,
            });
        }
    }

    handleFormChange = event => {
        this.setState({
            [event.target.dataset.statekey]: event.target.value,
            valid: false
        });
    }

    getServer = () => {
        return {
            server: this.state.electrumServer.trim(),
            pemCert: this.state.electrumCert,
            tls: true,
        };
    }

    add = () => {
        this.props.onAdd(this.getServer());
        this.setState({ electrumServer: '', electrumCert: '' });
    }

    downloadCert = () => {
        this.setState({
            loadingCert: true,
        });
        apiPost('certs/download', this.state.electrumServer.trim()).then(data => {
            if (data.success) {
                this.setState({ electrumCert: data.pemCert });
            } else {
                alert(data.errorMessage);
            }
            this.setState({
                loadingCert: false,
            });
        });
    }

    check = () => {
        this.setState({
            loadingCheck: true,
        });
        apiPost('certs/check', this.getServer()).then(({ success, errorMessage }) => {
            if (success) {
                alert(`Successfully established a connection to ${this.state.electrumServer}`);
            } else {
                alert('Failed:\n' + errorMessage);
            }
            this.setState({
                valid: success,
                loadingCheck: false,
            });
        });
    }

    render({
        t,
        server,
        onAdd,
        onRemove,
        index,
    }, {
        valid,
        electrumServer,
        electrumCert,
        loadingCheck,
        loadingCert,
    }) {
        if (!onAdd) {
            return (
                <div class={style.server}>
                    <div>{index}</div>
                    <div class="flex-1">{electrumServer}</div>
                    <div>
                        <button class={style.primary} disabled={electrumServer === '' || electrumCert === '' || loadingCheck} onClick={this.check}>
                            {
                                loadingCheck && (
                                    <div class={style.miniSpinnerContainer}>
                                        <div class={style.miniSpinner}></div>
                                    </div>
                                )
                            }
                            { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
                        </button>
                        <button class={style.warning} onClick={onRemove}>Remove</button>
                    </div>
                </div>
            );
        }
        return (
            <div class={style.addServer}>
                <p>{t('settings.electrum.step1')}</p>
                <Input
                    data-statekey="electrumServer"
                    onInput={this.handleFormChange}
                    value={electrumServer}
                    placeholder="host:port"
                />
                <p>{t('settings.electrum.step2')}</p>
                <textarea
                    class={style.textarea}
                    rows={10}
                    cols={80}
                    data-statekey="electrumCert"
                    onInput={this.handleFormChange}
                    value={electrumCert}
                    placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                />
                <div class={style.block}>
                    <Button primary disabled={loadingCert || electrumCert !== ''} onClick={this.downloadCert}>
                        {
                            loadingCert && (
                                <div class={style.miniSpinnerContainer}>
                                    <div class={style.miniSpinner}></div>
                                </div>
                            )
                        }
                        {t('settings.electrum.download_cert')}
                    </Button>
                </div>
                <p>{t('settings.electrum.step3')}</p>
                <div class="buttons wrapped">
                    <Button primary disabled={electrumServer === '' || loadingCheck} onClick={this.check}>
                        {
                            loadingCheck && (
                                <div class={style.miniSpinnerContainer}>
                                    <div class={style.miniSpinner}></div>
                                </div>
                            )
                        }
                        { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
                    </Button>
                    <Button primary disabled={!valid} onClick={this.add}>{t('settings.electrum.add_server')}</Button>
                </div>
                <p>{t('settings.electrum.step4')}</p>
            </div>
        );
    }
}

@translate()
class ElectrumServers extends Component {
    state = {
        electrumServers: [],
    }

    componentDidMount() {
        apiGet('config').then(config => {
            this.setState({ electrumServers: config.backend[this.props.coin].electrumServers });
        });
    }

    save = () => {
        apiGet('config').then(config => {
            config.backend[this.props.coin].electrumServers = this.state.electrumServers;
            apiPost('config', config);
        });
    }

    onAdd = server => {
        let electrumServers = this.state.electrumServers.slice();
        electrumServers.push(server);
        this.setState({ electrumServers });
        this.save();
    }

    onRemove = index => {
        let electrumServers = this.state.electrumServers.slice();
        electrumServers.splice(index, 1);
        this.setState({ electrumServers });
        this.save();
    }

    resetToDefault = () => {
        // @ts-ignore (non-standard usage of confirm method with a second argument)
        confirm('Do you want to remove all servers and install the default servers?', response => {
            if (response) {
                apiGet('config/default').then(config => {
                    this.setState({ electrumServers: config.backend[this.props.coin].electrumServers });
                    this.save();
                });
            } else {
                return;
            }
        });
    }

    render({
        t,
        coin,
    }, {
        electrumServers,
    }) {
        let onRemove = (server, index) => (() => {
            // @ts-ignore (non-standard usage of confirm method with a second argument)
            confirm(`Remove ${server.server}?`, confirmed => {
                if (confirmed) this.onRemove(index);
            });
        });
        return (
            <div class={style.serversContainer}>
                <div class="flex flex-row flex-between flex-items-center row">
                    <h3>{t(`settings.electrum.title-${coin}`)}</h3>
                    <div class="buttons" style="margin-bottom: 0;">
                        <Button onClick={this.resetToDefault} danger>{t('settings.electrum.reset')}</Button>
                    </div>
                </div>
                <div class="row">
                    <h4 class={style.title}>{t('settings.electrum.servers')}</h4>
                    <div class={style.servers}>
                        {
                            electrumServers.map((server, index) => (
                                <ElectrumServer
                                    index={index + 1}
                                    key={server.server}
                                    server={server}
                                    onRemove={onRemove(server, index)}
                                />
                            ))
                        }
                    </div>
                </div>
                <div class="row">
                    <h4 class={style.title}>{t('settings.electrum.add')}</h4>
                    <ElectrumServer server={null} onAdd={this.onAdd} />
                </div>
            </div>
        );
    }
}

@translate()
export default class ElectrumSettings extends Component {
    state = {
        testing: false,
        activeTab: 'btc',
    }

    componentDidMount() {
        apiGet('testing').then(testing => this.setState({ testing }));
    }

    handleTab = e => {
        const target = e.target.dataset.tab;
        this.setState({ activeTab: target });
    }

    render({
        t,
    }, {
        testing,
        activeTab,
    }) {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <div class="header">
                            <h2>{t('settings.expert.electrum.title')}</h2>
                        </div>
                        <div class="flex flex-row flex-between flex-items-center tabs">
                            <div class={['tab', activeTab === 'btc' ? 'active' : ''].join(' ')}>
                                <a href="#" onClick={this.handleTab} data-tab="btc">{testing ? 'TBTC' : 'BTC'}</a>
                            </div>
                            <div class={['tab', activeTab === 'ltc' ? 'active' : ''].join(' ')}>
                                <a href="#" onClick={this.handleTab} data-tab="ltc">{testing ? 'TLTC' : 'LTC'}</a>
                            </div>
                        </div>
                    </div>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                activeTab === 'btc' && (
                                    <ElectrumServers
                                        key={testing ? 'tbtc' : 'btc'}
                                        coin={testing ? 'tbtc' : 'btc'}
                                    />
                                )
                            }
                            {
                                activeTab === 'ltc' && (
                                    <ElectrumServers
                                        key={testing ? 'tltc' : 'ltc'}
                                        coin={testing ? 'tltc' : 'ltc'}
                                    />
                                )
                            }
                            <div style="margin-bottom: 20px;">
                                <ButtonLink
                                    secondary
                                    href={`/settings`}>
                                    {t('button.back')}
                                </ButtonLink>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide screen="settings-electrum" />
            </div>
        );
    }
}
