import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Guide } from '../../components/guide/guide';
import { ButtonLink } from '../../components/forms';
import { apiGet, apiPost } from '../../utils/request';
import style from './settings.css';

@translate()
class ElectrumServer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            valid: false,
            electrumServer: '',
            electrumCert: ''
        }
        if (props.server !== null) {
            this.state.electrumServer = props.server.server;
            this.state.electrumCert = props.server.pemCert;
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
        apiPost('certs/download', this.state.electrumServer.trim()).then(data => {
            if (data.success) {
                this.setState({ electrumCert: data.pemCert });
            } else {
                alert(data.errorMessage)
            }
        });
    }

    check = () => {
        apiPost('certs/check', this.getServer()).then(({ success, errorMessage }) => {
            if (success) {
                alert(`Successfully established a connection to ${this.state.electrumServer}`)
            } else {
                alert("Failed:\n" + errorMessage);
            }
            this.setState({ valid: success });
        });
    }

    render({ server, onAdd, onRemove }, { valid, electrumServer, electrumCert }) {
        if (!onAdd) {
            return (
                <span>
                    {electrumServer}
                    {' '}
                    <input type="button" value="check" disabled={electrumServer == '' || electrumCert == ''} onClick={this.check}/>
                    <input type="button" value="remove" onClick={onRemove}/>
                </span>
            );
        }
        return (
            <span>
                <span>Step 1. Enter the endpoint</span><br/>
                <input
                    data-statekey="electrumServer"
                    onInput={this.handleFormChange}
                    value={electrumServer}
                    placeholder="host:port"
                /><br/>
                <span>Step 2: Enter a certificate of the server's certificate chain. Alternatively, download the remote certificate and compare it visually.</span><br/>
                <textarea
                    rows={10}
                    cols={80}
                    data-statekey="electrumCert"
                    onInput={this.handleFormChange}
                    value={electrumCert}
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                /><br/>
                <input type="button" value="Download remote certificate" disabled={electrumCert != ''} onClick={this.downloadCert}/><br/>
                <span>Step 3: Check the connection and add the server.</span><br/>
                <input type="button" value="check" disabled={electrumServer == ''} onClick={this.check}/>
                <input type="button" value="add" disabled={!valid} onClick={this.add}/>
            </span>
        );
    }
}

@translate()
class ElectrumServers extends Component {
    constructor(props) {
        super(props);

        this.state = {
            electrumServers: []
        }
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

    render({ t, coin }, { electrumServers }) {
        return (
            <div>
                <h3>{t(`settings.electrum.title-${coin}`)}</h3>
                <input type="button" value="Reset to default" onClick={this.resetToDefault}/><br/>
                <h4>Servers</h4>
                { electrumServers.map((server, index) => (
                    <p>
                        #{index+1} {' – '}
                        <ElectrumServer
                            key={server.server}
                            server={server}
                            onRemove={() => { if (confirm(`Remove ${server.server}?`)) this.onRemove(index) }}
                        />
                    </p>
                ))}
                <h4>Add server</h4>
                <ElectrumServer server={null} onAdd={this.onAdd}/>
            </div>
        );
    }
}

@translate()
export default class ElectrumSettings extends Component {
    state = {
        testing: false
    }

    componentDidMount() {
        apiGet('testing').then(testing => this.setState({ testing }));
    }

    render({ t, guide }, { testing }) {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <div class="header">
                            <h2>{t('settings.expert.electrum.title')}</h2>
                        </div>
                    </div>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="flex flex-row flex-start flex-wrap wrapped">
                                <div class={style.column}>
                                    <ElectrumServers
                                        key={testing ? 'tbtc' : 'btc'}
                                        coin={testing ? 'tbtc' : 'btc'}
                                    />
                                    <hr />
                                    <ElectrumServers
                                        key={testing ? 'tltc' : 'ltc'}
                                        coin={testing ? 'tltc' : 'ltc'}
                                    />
                                </div>
                                <ButtonLink
                                    secondary
                                    href={`/settings`}>
                                    {t('button.back')}
                                </ButtonLink>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide guide={guide} screen="settings-electrum" />
            </div>
        );
    }
}
