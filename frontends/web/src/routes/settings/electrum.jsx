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
import { Entry } from '../../components/guide/entry';
import { ButtonLink, Button, Input } from '../../components/forms';
import { apiGet, apiPost } from '../../utils/request';
import { Header } from '../../components/layout';
import { confirmation } from '../../components/confirm/Confirm';
import { alertUser } from '../../components/alert/Alert';
import * as style from './settings.css';
import A from '../../components/anchor/anchor';

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
            [event.target.name]: event.target.value,
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
                alertUser(data.errorMessage);
            }
            this.setState({ loadingCert: false });
        });
    }

    check = () => {
        this.setState({ loadingCheck: true });
        apiPost('certs/check', this.getServer()).then(({ success, errorMessage }) => {
            if (success) {
                alertUser(this.props.t('settings.electrum.checkSuccess', { host: this.state.electrumServer }));
            } else {
                alertUser(this.props.t('settings.electrum.checkFailed') + ':\n' + errorMessage);
            }
            this.setState({
                valid: success,
                loadingCheck: false,
            });
        });
    }

    render({
        t,
        onAdd,
        onRemove,
    }, {
        valid,
        electrumServer,
        electrumCert,
        loadingCheck,
        loadingCert,
    }) {
        if (!onAdd) {
            return (
                <li>
                    <div class={style.server}>
                        <div>{electrumServer}</div>
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
                            <button class={style.warning} onClick={onRemove}>{t('settings.electrum.remove-server')}</button>
                        </div>
                    </div>
                </li>
            );
        }
        return (
            <div class={style.addServer}>
                <div class="flex flex-row flex-start flex-wrap">
                    <p class={style.badge}>{t('settings.electrum.step1')}</p>
                    <div class="flex-1">
                        <p>{t('settings.electrum.step1-text')}</p>
                    </div>
                </div>
                <Input
                    name="electrumServer"
                    onInput={this.handleFormChange}
                    value={electrumServer}
                    placeholder="host:port"
                />
                <div class="flex flex-row flex-start flex-wrap">
                    <p class={style.badge}>{t('settings.electrum.step2')}</p>
                    <div class="flex-1">
                        <p>{t('settings.electrum.step2-text')}</p>
                    </div>
                </div>
                <textarea
                    class={style.textarea}
                    rows={10}
                    cols={80}
                    name="electrumCert"
                    onInput={this.handleFormChange}
                    value={electrumCert}
                    placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                />
                <div class={[style.block, 'flex flex-row flex-end'].join(' ')}>
                    <Button primary disabled={loadingCert || electrumCert !== ''} onClick={this.downloadCert}>
                        {
                            loadingCert && (
                                <div class={style.miniSpinnerContainer}>
                                    <div class={style.miniSpinner}></div>
                                </div>
                            )
                        }
                        {t('settings.electrum.download-cert')}
                    </Button>
                </div>
                <div class="flex flex-row flex-start flex-wrap">
                    <p class={style.badge}>{t('settings.electrum.step3')}</p>
                    <div class="flex-1">
                        <p>{t('settings.electrum.step3-text')}</p>
                    </div>
                </div>
                <div class={['flex flex-row flex-end spaced', style.block].join(' ')}>
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
                    <Button primary disabled={!valid} onClick={this.add}>{t('settings.electrum.add-server')}</Button>
                </div>
                <div class="flex flex-row flex-start flex-wrap">
                    <p class={style.badge}>{t('settings.electrum.step4')}</p>
                    <div class="flex-1">
                        <p>{t('settings.electrum.step4-text')}</p>
                    </div>
                </div>
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
        confirmation(this.props.t('settings.electrum.resetConfirm'), response => {
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
    }, {
        electrumServers,
    }) {
        let onRemove = (server, index) => (() => {
            confirmation(t('settings.electrum.removeConfirm', { server: server.server }), confirmed => {
                if (confirmed) this.onRemove(index);
            });
        });
        return (
            <div class={style.serversContainer}>
                <div class="row">
                    <div className={['flex flex-row flex-between flex-items-center', style.titleContainer].join(' ')}>
                        <h4 class={style.title}>{t('settings.electrum.servers')}</h4>
                        <A href="#" className={['labelLarge labelLink', style.resetLink].join(' ')} onClick={this.resetToDefault}>{t('settings.electrum.reset')}</A>
                    </div>
                    <ul class={style.servers}>
                        {
                            electrumServers.map((server, index) => (
                                <ElectrumServer
                                    key={server.server}
                                    server={server}
                                    onRemove={onRemove(server, index)}
                                />
                            ))
                        }
                    </ul>
                </div>
                <hr />
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
                    <Header title={<h2>{t('settings.expert.electrum.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="flex flex-row flex-between flex-items-center tabs">
                                <div class={['tab', activeTab === 'btc' ? 'active' : ''].join(' ')}>
                                    <a href="#" onClick={this.handleTab} data-tab="btc">{t(`settings.electrum.title-${testing ? 'tbtc' : 'btc'}`)}</a>
                                </div>
                                <div class={['tab', activeTab === 'ltc' ? 'active' : ''].join(' ')}>
                                    <a href="#" onClick={this.handleTab} data-tab="ltc">{t(`settings.electrum.title-${testing ? 'tltc' : 'ltc'}`)}</a>
                                </div>
                            </div>
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
                <Guide>
                    <Entry key="guide.settings-electrum.what" entry={t('guide.settings-electrum.what')} />
                </Guide>
            </div>
        );
    }
}
