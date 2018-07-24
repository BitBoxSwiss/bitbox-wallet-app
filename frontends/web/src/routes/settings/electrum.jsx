import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Guide } from '../../components/guide/guide';
import { ButtonLink, Button, Input } from '../../components/forms';
import { apiGet, apiPost } from '../../utils/request';
import Spinner from '../../components/spinner/Spinner';
import style from './settings.css';

@translate()
class ElectrumServer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            valid: false,
            electrumServer: '',
            electrumCert: '',
            loading: false,
            loadingText: '',
        }
        if (props.server !== null) {
            this.setState({
                electrumServer: props.server.server,
                electrumCert: props.server.pemCert,
            })
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
            loading: true,
            loadingText: 'Downloading certificate...'
        });
        apiPost('certs/download', this.state.electrumServer.trim()).then(data => {
            if (data.success) {
                this.setState({ electrumCert: data.pemCert });
            } else {
                alert(data.errorMessage)
            }
            this.setState({
                loading: false,
                loadingText: '',
            });
        });
    }

    check = () => {
        this.setState({
            loading: true,
            loadingText: 'Checking server...',
        });
        apiPost('certs/check', this.getServer()).then(({ success, errorMessage }) => {
            if (success) {
                alert(`Successfully established a connection to ${this.state.electrumServer}`)
            } else {
                alert("Failed:\n" + errorMessage);
            }
            this.setState({
                valid: success,
                loading: false,
                loadingText: '',
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
        loading,
        loadingText,
    }) {
        if (loading) return <Spinner text={loadingText} />
        if (!onAdd) {
            return (
                <div class={style.server}>
                    <div>{index}</div>
                    <div class="flex-1">{electrumServer}</div>
                    <div>
                        <input class={style.primary} type="button" value="Check" disabled={electrumServer == '' || electrumCert == ''} onClick={this.check}/>
                        <input class={style.warning} type="button" value="Remove" onClick={onRemove}/>
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
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                />
                <div class={style.block}>
                    <Button primary disabled={electrumCert != ''} onClick={this.downloadCert}>{t('settings.electrum.download_cert')}</Button>
                </div>
                <p>{t('settings.electrum.step3')}</p>
                <div class="buttons wrapped">
                    <Button primary disabled={electrumServer == ''} onClick={this.check}>{t('settings.electrum.check')}</Button>
                    <Button primary disabled={!valid} onClick={this.add}>{t('settings.electrum.add_server')}</Button>
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
        if (!confirm('Do you want to remove all servers and install the default servers?')) {
            return;
        }
        apiGet('config/default').then(config => {
            this.setState({ electrumServers: config.backend[this.props.coin].electrumServers });
            this.save();
        });
    }

    render({
      t,
      coin,
    }, {
      electrumServers,
    }) {
        return (
            <div class={style.serversContainer}>
                <div class="flex flex-row flex-between flex-items-center row">
                    <h3>{t(`settings.electrum.title-${coin}`)}</h3>
                    <div class="buttons" style="margin-bottom: 0;">
                        <ButtonLink
                            secondary
                            href={`/settings`}>
                            {t('button.back')}
                        </ButtonLink>
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
                                    onRemove={() => { if (confirm(`Remove ${server.server}?`)) this.onRemove(index) }}
                                />
                            ))
                        }
                    </div>
                </div>
                <div class="row">
                    <h4 class={style.title}>{t('settings.electrum.add')}</h4>
                    <ElectrumServer server={null} onAdd={this.onAdd}/>
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
        guide,
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
                        </div>
                    </div>
                </div>
                <Guide guide={guide} screen="settings-electrum" />
            </div>
        );
    }
}
