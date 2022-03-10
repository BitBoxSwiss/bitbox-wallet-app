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

import { Component} from 'react';
import { withTranslation } from 'react-i18next';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { ButtonLink, Button, Input } from '../../components/forms';
import { apiGet, apiPost } from '../../utils/request';
import { Header } from '../../components/layout';
import { confirmation } from '../../components/confirm/Confirm';
import { alertUser } from '../../components/alert/Alert';
import style from './electrum.module.css';
import A from '../../components/anchor/anchor';

class ElectrumServerClass extends Component {
    state = {
        valid: false,
        electrumServer: '',
        electrumCert: '',
        tls: false,
        loadingCheck: false,
        loadingCert: false,
    }

    componentDidMount() {
        if (this.props.server !== null) {
            this.setState({
                electrumServer: this.props.server.server,
                electrumCert: this.props.server.pemCert,
                tls: this.props.server.tls,
            });
        }
    }

    isTLS = () => {
        if (this.props.server === null) { // in add-mode
            return this.state.electrumCert !== '';
        }
        // in list-mode
        return this.props.server.tls;
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
            tls: this.isTLS(),
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
        apiPost('electrum/check', this.getServer()).then(({ success, errorMessage }) => {
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

    render() {
        const {
            t,
            onAdd,
            onRemove,
        } = this.props;
        const {
            valid,
            electrumServer,
            electrumCert,
            tls,
            loadingCheck,
            loadingCert,
        } = this.state;
        if (!onAdd) {
            return (
                <li>
                    <div className={style.server}>
                        <div className={style.serverLabel}>
                            {electrumServer}
                            {' '}
                            <strong>{tls ? 'TLS' : 'TCP' }</strong>
                        </div>
                        <div>
                            <button className={style.primary} disabled={electrumServer === '' || (tls && electrumCert === '') || loadingCheck} onClick={this.check}>
                                {
                                    loadingCheck && (
                                        <div className={style.miniSpinnerContainer}>
                                            <div className={style.miniSpinner}></div>
                                        </div>
                                    )
                                }
                                { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
                            </button>
                            <button className={style.warning} onClick={onRemove}>{t('settings.electrum.remove-server')}</button>
                        </div>
                    </div>
                </li>
            );
        }
        return (
            <div className={style.addServer}>
                <div className="flex flex-row flex-start flex-wrap">
                    <p className={style.badge}>{t('settings.electrum.step1')}</p>
                    <div className="flex-1">
                        <p>{t('settings.electrum.step1-text')}</p>
                    </div>
                </div>
                <Input
                    name="electrumServer"
                    onInput={this.handleFormChange}
                    value={electrumServer}
                    placeholder="host:port"
                />
                <div className="flex flex-row flex-start flex-wrap">
                    <p className={style.badge}>{t('settings.electrum.step2')}</p>
                    <div className="flex-1">
                        <p>{t('settings.electrum.step2-text')}</p>
                        <p>{t('settings.electrum.step2-text-tcp')}</p>
                    </div>
                </div>
                <textarea
                    className={style.textarea}
                    rows={10}
                    cols={80}
                    name="electrumCert"
                    onInput={this.handleFormChange}
                    value={electrumCert}
                    placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                />
                <div className={[style.block, 'flex flex-row flex-end'].join(' ')}>
                    <Button primary disabled={loadingCert || electrumCert !== ''} onClick={this.downloadCert}>
                        {
                            loadingCert && (
                                <div className={style.miniSpinnerContainer}>
                                    <div className={style.miniSpinner}></div>
                                </div>
                            )
                        }
                        {t('settings.electrum.download-cert')}
                    </Button>
                </div>
                <div className="flex flex-row flex-start flex-wrap">
                    <p className={style.badge}>{t('settings.electrum.step3')}</p>
                    <div className="flex-1">
                        <p>{t('settings.electrum.step3-text')}</p>
                    </div>
                </div>
                <div className={['flex flex-row flex-end spaced', style.block].join(' ')}>
                    <Button primary disabled={electrumServer === '' || loadingCheck} onClick={this.check}>
                        {
                            loadingCheck && (
                                <div className={style.miniSpinnerContainer}>
                                    <div className={style.miniSpinner}></div>
                                </div>
                            )
                        }
                        { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
                    </Button>
                    <Button primary disabled={!valid} onClick={this.add}>{t('settings.electrum.add-server')}</Button>
                </div>
                <div className="flex flex-row flex-start flex-wrap">
                    <p className={style.badge}>{t('settings.electrum.step4')}</p>
                    <div className="flex-1">
                        <p>{t('settings.electrum.step4-text')}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export const ElectrumServer = withTranslation()(ElectrumServerClass);

class ElectrumServersClass extends Component {
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

    render() {
        const { t } = this.props;
        const { electrumServers } = this.state;
        let onRemove = (server, index) => (() => {
            confirmation(t('settings.electrum.removeConfirm', { server: server.server }), confirmed => {
                if (confirmed) this.onRemove(index);
            });
        });
        return (
            <div className={style.serversContainer}>
                <div className="row">
                    <div className={['flex flex-row flex-between flex-items-center', style.titleContainer].join(' ')}>
                        <h4 className="subTitle m-none">{t('settings.electrum.servers')}</h4>
                        <A href="#" className={['labelLarge labelLink', style.resetLink].join(' ')} onClick={this.resetToDefault}>{t('settings.electrum.reset')}</A>
                    </div>
                    <ul className={style.servers}>
                        {
                            electrumServers.map((server, index) => (
                                <ElectrumServer
                                    // @ts-ignore
                                    key={server.server + server.tls.toString()}
                                    server={server}
                                    onRemove={onRemove(server, index)}
                                />
                            ))
                        }
                    </ul>
                </div>
                <hr />
                <div className="row">
                    <h4 className="subTitle">{t('settings.electrum.add')}</h4>
                    <ElectrumServer server={null} onAdd={this.onAdd} />
                </div>
            </div>
        );
    }
}

const ElectrumServers = withTranslation()(ElectrumServersClass);

class ElectrumSettings extends Component {
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

    render() {
        const { i18n, t } = this.props;
        const { testing, activeTab } = this.state;
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('settings.expert.electrum.title')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <div className="flex flex-row flex-between flex-items-center tabs">
                                <div className={['tab', activeTab === 'btc' ? 'active' : ''].join(' ')}>
                                    <a href="#" onClick={this.handleTab} data-tab="btc">{t(`settings.electrum.title-${testing ? 'tbtc' : 'btc'}`)}</a>
                                </div>
                                <div className={['tab', activeTab === 'ltc' ? 'active' : ''].join(' ')}>
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
                            <div style={{marginBottom: 20}}>
                                <ButtonLink
                                    secondary
                                    to={'/settings'}>
                                    {t('button.back')}
                                </ButtonLink>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.settings-electrum.what" entry={t('guide.settings-electrum.what')} />
                    <Entry key="guide.settings-electrum.why" entry={t('guide.settings-electrum.why')} />
                    <Entry key="guide.settings-electrum.options" entry={t('guide.settings-electrum.options')} />
                    <Entry key="guide.settings-electrum.connection" entry={t('guide.settings-electrum.connection')} />
                    <Entry key="guide.settings-electrum.tor" entry={t('guide.settings-electrum.tor')} />
                    <Entry key="guide.settings-electrum.instructions" entry={{
                        link: {
                            text: t('guide.settings-electrum.instructions.link.text'),
                            url: (i18n.language === 'de')
                                ? 'https://shiftcrypto.support/help/de-de/14-privatsphare/29-verbindung-der-bitboxapp-zu-meinem-bitcoin-full-node'
                                : 'https://shiftcrypto.support/help/en-us/14-privacy/29-how-to-connect-the-bitboxapp-to-my-own-full-node'
                        },
                        text: t('guide.settings-electrum.instructions.text'),
                        title: t('guide.settings-electrum.instructions.title')
                    }} />
                </Guide>
            </div>
        );
    }
}

export default withTranslation()(ElectrumSettings);
