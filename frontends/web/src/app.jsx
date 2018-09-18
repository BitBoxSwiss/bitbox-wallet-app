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

// @ts-nocheck

import { Component, h } from 'preact';
import { Router, route } from 'preact-router';
import { apiGet } from './utils/request';
import { apiWebsocket } from './utils/websocket';
import { Update } from './components/update/update';
import Sidebar from './components/sidebar/sidebar';
import Device from './routes/device/device';
import Account from './routes/account/account';
import Send from './routes/account/send/send';
import Receive from './routes/account/receive/receive';
import Info from './routes/account/info/info';
import Settings from './routes/settings/settings';
import ElectrumSettings from './routes/settings/electrum';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import Alert from './components/alert/Alert';
import Confirm from './components/confirm/Confirm';

export class App extends Component {
    state = {
        accounts: [],
        accountsInitialized: false,
        deviceIDs: [],
    }

    /**
     * Gets fired when the route changes.
     * @param {Object} event "change" event from [preact-router](http://git.io/preact-router)
     * @param {string} event.url The newly routed URL
     */
    handleRoute = event => {}

    componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onAccountsStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data }) => {
            switch (type) {
            case 'backend':
                switch (data) {
                case 'accountsStatusChanged':
                    this.onAccountsStatusChanged();
                    break;
                }
                break;
            case 'device':
                switch (data) {
                case 'keystoreAvailable':
                    this.onAccountsStatusChanged();
                    break;
                case 'keystoreGone':
                    this.onAccountsStatusChanged();
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
            }
        });
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(deviceIDs => {
            this.setState({ deviceIDs });
        });
    }

    onAccountsStatusChanged = () => {
        apiGet('accounts-status').then(status => {
            const accountsInitialized = status === 'initialized';
            this.setState({
                accountsInitialized
            });
            if (!accountsInitialized) {
                console.log('app.jsx route /'); // eslint-disable-line no-console
                route('/', true);
            }

            apiGet('accounts').then(accounts => this.setState({ accounts }));
        });
    }

    render({}, {
        accounts,
        deviceIDs,
        accountsInitialized,
    }) {
        return (
            <div className="app">
                <Sidebar
                    accounts={accounts}
                    deviceIDs={deviceIDs}
                    accountsInitialized={accountsInitialized} />
                <div class="flex-column flex-1">
                    <Update />
                    <Router onChange={this.handleRoute}>
                        <Send
                            path="/account/:code/send"
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <Receive
                            path="/account/:code/receive"
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <Info
                            path="/account/:code/info"
                            accounts={accounts} />
                        <Account
                            path="/account/:code?"
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <ElectrumSettings
                            path="/settings/electrum" />
                        <Settings
                            path="/settings"
                            deviceIDs={deviceIDs} />
                        {/* Use with TypeScript: {Route<{ deviceID: string }>({ path: '/manage-backups/:deviceID', component: ManageBackups })} */}
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            // showCreate={true} // Does not exist!
                            // deviceIDs={deviceIDs} // Does not exist!
                        />
                        <Device
                            path="/device/:deviceID"
                            deviceIDs={deviceIDs} />
                        <Device
                            default
                            deviceID={deviceIDs[0]}
                            deviceIDs={deviceIDs} />
                    </Router>
                </div>
                <Alert />
                <Confirm />
            </div>
        );
    }
}
