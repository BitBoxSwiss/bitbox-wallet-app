import { Component } from 'preact';
import { Router, route } from 'preact-router';
import { translate } from 'react-i18next';

import { apiGet, apiPost } from './utils/request';
import { apiWebsocket } from './utils/websocket';
import Sidebar from './components/sidebar/sidebar';
import Device from './routes/device/device';
import Account from './routes/account/account';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import Alert from './components/alert/Alert';
import Status from './components/status/status';
import A from './components/anchor/anchor';

@translate()
export default class App extends Component {
    state = {
        backendConnected: true,
        walletInitialized: false,
        deviceIDs: [],
        update: null,
        guideShown: false,
    }

    /**
     * Gets fired when the route changes.
     * @param {Object} event "change" event from [preact-router](http://git.io/preact-router)
     * @param {string} event.url The newly routed URL
     */
    handleRoute = event => {}

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onWalletStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data }) => {
            switch (type) {
            case 'frontend': // special event from websocket.js
                if (data === 'closed') {
                    this.setState({ backendConnected: false });
                }
                break;
            case 'backend':
                switch (data) {
                case 'walletStatusChanged':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            case 'device':
                switch (data) {
                case 'keystoreAvailable':
                    this.onWalletStatusChanged();
                    break;
                case 'keystoreGone':
                    this.onWalletStatusChanged();
                    break;
                }
                break;
            case 'devices':
                switch (data) {
                case 'registeredChanged':
                    this.onDevicesRegisteredChanged();
                    break;
                }
                break;
            case 'update':
                this.setState({ update: data });
                break;
            }
        });

        apiGet('config').then(({ frontend }) => {
            if (!frontend || frontend.guideShown == null) {
                return this.setState({ guideShown: true });
            }
            this.setState({ guideShown: frontend.guideShown });
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(deviceIDs => {
            this.setState({ deviceIDs });
        });
    }

    onWalletStatusChanged = () => {
        apiGet('wallet-status').then(status => {
            const walletInitialized = status === 'initialized';
            this.setState({
                walletInitialized
            });
            if (!walletInitialized) {
                // console.log('uninitialized! route to /')
                route('/', true);
            }
        });
    }

    toggleGuide = (show) => {
        this.setState(state => {
            const guideShown = (typeof show === 'boolean') ? show : !state.guideShown;
            setFrontendConfig({ guideShown });
            return { guideShown };
        });
    }

    showGuide = () => {
        this.setState({ guideShown: true });
    }

    hideGuide = () => {
        this.setState({ guideShown: false });
    }

    render({ t }, { backendConnected, deviceIDs, walletInitialized, update, guideShown }) {
        if (!backendConnected) {
            return (
                <div className="app" style="padding: 40px">
                    An error occurred. Please restart the application.
                </div>
            );
        }
        const guide = { shown: guideShown, toggle: this.toggleGuide, show: this.showGuide, hide: this.hideGuide };
        return (
            <div className="app">
                {walletInitialized && (<Sidebar deviceIDs={deviceIDs} />)}
                <div class="flex-column flex-1">
                    {update && <Status dismissable keyName={`update-${update.version}`} type="info">
                        A new version of this app is available! We recommend that you upgrade
                        from {update.current} to {update.version}. {update.description}
                        &nbsp;<A href="https://shiftcrypto.ch/start">Download</A>
                    </Status>}
                    <Router onChange={this.handleRoute}>
                        {/*
                        <Redirect path="/" to={`/account/${wallets[0].code}`} />
                        */}
                        <Account path="/account/:code?" deviceIDs={deviceIDs} guide={guide} />
                        <Settings path="/settings" deviceIDs={deviceIDs} guide={guide} />
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            showCreate={true}
                            displayError={(msg) => { if (msg) alert('TODO' + msg); }}
                            deviceIDs={deviceIDs}
                            guide={guide} />
                        <Device path="/device/:deviceID" deviceIDs={deviceIDs} guide={guide} />
                        <Device
                            default
                            deviceID={deviceIDs[0]}
                            deviceIDs={deviceIDs}
                            guide={guide} />
                    </Router>
                </div>
                <Alert />
            </div>
        );
    }
}

function setFrontendConfig(obj) {
    apiGet('config').then((config) => {
        const newConf = Object.assign(config, {
            frontend: Object.assign({}, config.frontend, obj)
        });
        apiPost('config', newConf);
    });
}
