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

import { Component } from 'preact';
import { Router, route } from 'preact-router';
import { translate } from 'react-i18next';

import { apiGet } from './utils/request';
import { setConfig } from './utils/config';
import { apiWebsocket } from './utils/websocket';
import { equal } from './utils/equal';
import Sidebar from './components/sidebar/sidebar';
import Device from './routes/device/device';
import Account from './routes/account/account';
import Send from './routes/account/send/send';
import Receive from './routes/account/receive/receive';
import Settings from './routes/settings/settings';
import ElectrumSettings from './routes/settings/electrum';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import Alert from './components/alert/Alert';
import Status from './components/status/status';
import A from './components/anchor/anchor';

@translate()
export default class App extends Component {
    state = {
        accounts: [],
        backendConnected: true,
        walletInitialized: false,
        deviceIDs: [],
        update: null,
        guideShown: false,
        fiatCode: 'CHF',
        fiatList: ['USD', 'EUR', 'CHF'],
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
            if (frontend && frontend.guideShown != null) { // eslint-disable-line eqeqeq
                this.setState({ guideShown: frontend.guideShown });
            } else {
                this.setState({ guideShown: true });
            }
            if (frontend && frontend.fiatCode) {
                this.setState({ fiatCode: frontend.fiatCode });
            }
            if (frontend && frontend.fiatList) {
                this.setState({ fiatList: frontend.fiatList });
            }
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
                console.log('app.jsx route /'); // eslint-disable-line no-console
                route('/', true);
            }

            apiGet('wallets').then(accounts => this.setState({ accounts }));
        });
    }

    toggleGuide = (show) => {
        this.setState(state => {
            const guideShown = (typeof show === 'boolean') ? show : !state.guideShown;
            setConfig({ frontend: { guideShown } });
            return { guideShown };
        });
    }

    showGuide = () => {
        this.setState({ guideShown: true });
    }

    hideGuide = () => {
        this.setState({ guideShown: false });
    }

    setFiatCode = (fiatCode) => {
        if (!this.state.fiatList.includes(fiatCode)) {
            this.addToFiatList(fiatCode);
        }
        this.setState({ fiatCode });
        setConfig({ frontend: { fiatCode } });
    }

    nextFiatCode = () => {
        this.setState(state => {
            const index = state.fiatList.indexOf(state.fiatCode);
            const fiatCode = state.fiatList[(index + 1) % state.fiatList.length];
            setConfig({ frontend: { fiatCode } });
            return { fiatCode };
        });
    }

    addToFiatList = (fiatCode) => {
        this.setState(state => {
            const fiatList = state.fiatList ? [...state.fiatList, fiatCode] : [fiatCode];
            setConfig({ frontend: { fiatList } });
            return { fiatList };
        });
    }

    removeFromFiatList = (fiatCode) => {
        this.setState(state => {
            const fiatList = state.fiatList.filter(item => !equal(item, fiatCode));
            setConfig({ frontend: { fiatList } });
            return { fiatList };
        });
    }

    render({ t }, {
        accounts,
        backendConnected,
        deviceIDs,
        walletInitialized,
        update,
        guideShown,
        fiatCode,
        fiatList
    }) {
        if (!backendConnected) {
            return (
                <div className="app" style="padding: 40px">
                    An error occurred. Please restart the application.
                </div>
            );
        }
        const guide = { shown: guideShown, toggle: this.toggleGuide, show: this.showGuide, hide: this.hideGuide };
        const fiat = { code: fiatCode, list: fiatList, set: this.setFiatCode, next: this.nextFiatCode, add: this.addToFiatList, remove: this.removeFromFiatList };
        return (
            <div className="app">
                {(<Sidebar accounts={accounts} deviceIDs={deviceIDs} walletInitialized={walletInitialized} guideShown={guideShown} />)}
                <div class="flex-column flex-1">
                    {update && <Status dismissable keyName={`update-${update.version}`} type="info">
                        {t('app.upgrade', {
                            current: update.current,
                            version: update.version
                        })} {update.description}
                        {' '}
                        <A href="https://shiftcrypto.ch/start">
                            {t('button.download')}
                        </A>
                    </Status>}
                    <Router onChange={this.handleRoute}>
                        <Send
                            path="/account/:code/send"
                            deviceIDs={deviceIDs}
                            accounts={accounts}
                            guide={guide}
                            fiat={fiat} />
                        <Receive
                            path="/account/:code/receive"
                            deviceIDs={deviceIDs}
                            accounts={accounts}
                            guide={guide}
                            fiat={fiat} />
                        <Account
                            path="/account/:code?"
                            deviceIDs={deviceIDs}
                            accounts={accounts}
                            guide={guide}
                            fiat={fiat} />
                        <ElectrumSettings
                            path="/settings/electrum"
                            guide={guide} />
                        <Settings
                            path="/settings"
                            deviceIDs={deviceIDs}
                            guide={guide}
                            fiat={fiat} />
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            showCreate={true}
                            deviceIDs={deviceIDs}
                            guide={guide} />
                        <Device
                            path="/device/:deviceID"
                            deviceIDs={deviceIDs}
                            guide={guide} />
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
