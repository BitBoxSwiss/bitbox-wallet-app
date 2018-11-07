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

import { i18nEditorActive } from './i18n/i18n';
import TranslationHelper from './components/translationhelper/translationhelper';
import { Component, h } from 'preact';
import { getCurrentUrl, route } from 'preact-router';
import { apiGet } from './utils/request';
import { apiWebsocket } from './utils/websocket';
import { Update } from './components/update/update';
import Sidebar from './components/sidebar/sidebar';
import Container from './components/container/Container';
import { DeviceSwitch } from './routes/device/deviceswitch';
import Account from './routes/account/account';
import Send from './routes/account/send/send';
import Receive from './routes/account/receive/receive';
import Info from './routes/account/info/info';
import Settings from './routes/settings/settings';
import ElectrumSettings from './routes/settings/electrum';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import { Alert } from './components/alert/Alert';
import { Confirm } from './components/confirm/Confirm';
import { AddAccount } from './routes/account/add/addaccount';

export class App extends Component {
    state = {
        accounts: null,
        accountsInitialized: false,
        deviceIDs: [],
        devices: {},
        activeSidebar: false,
    }

    /**
     * Gets fired when the route changes.
     * @param {Object} event "change" event from [preact-router](http://git.io/preact-router)
     * @param {string} event.url The newly routed URL
     */
    handleRoute = event => {
        if (this.state.activeSidebar) {
            this.setState({ activeSidebar: !this.state.activeSidebar });
        }
    }

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
        apiGet('devices/registered').then(devices => {
            const deviceIDs = Object.keys(devices);
            this.setState({ devices, deviceIDs });
        });
    }

    onAccountsStatusChanged = () => {
        apiGet('accounts-status').then(status => {
            const accountsInitialized = status === 'initialized';
            if (!accountsInitialized && getCurrentUrl().match(/^\/account\//)) {
                console.log('app.jsx route /'); // eslint-disable-line no-console
                route('/', true);
            }
            this.setState({ accountsInitialized });
            apiGet('accounts').then(accounts => this.setState({ accounts }));
        });
    }

    toggleSidebar = () => {
        this.setState(({ activeSidebar }) => ({ activeSidebar: !activeSidebar }));
    }

    render({}, {
        accounts,
        devices,
        deviceIDs,
        accountsInitialized,
        activeSidebar,
    }) {
        return (
            <div className={['app', i18nEditorActive ? 'i18nEditor' : ''].join(' ')}>
                <TranslationHelper />
                <Sidebar
                    accounts={accounts}
                    deviceIDs={deviceIDs}
                    accountsInitialized={accountsInitialized}
                    toggle={this.toggleSidebar}
                    show={activeSidebar} />
                <div class="appContent flex-column flex-1" style="min-width: 0;">
                    <Update />
                    <Container toggleSidebar={this.toggleSidebar} onChange={this.handleRoute}>
                        <Send
                            path="/account/:code/send"
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <Receive
                            path="/account/:code/receive"
                            deviceIDs={deviceIDs} />
                        <Info
                            path="/account/:code/info"
                            accounts={accounts} />
                        <Account
                            path="/account/:code?"
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <AddAccount
                            path="/add-account" />
                        <ElectrumSettings
                            path="/settings/electrum" />
                        <Settings
                            path="/settings" />
                        {/* Use with TypeScript: {Route<{ deviceID: string }>({ path: '/manage-backups/:deviceID', component: ManageBackups })} */}
                        {/* ManageBackups and DeviceSwitch need a key to trigger (re-)mounting when devices change, to handle routing */}
                        <ManageBackups
                            path="/manage-backups/:deviceID"
                            key={devices}
                            devices={devices}
                        />
                        <DeviceSwitch
                            path="/device/:deviceID"
                            key={devices}
                            devices={devices} />
                        <DeviceSwitch
                            default
                            key={devices}
                            deviceID={null}
                            devices={devices} />
                    </Container>
                </div>
                <Alert />
                <Confirm />
            </div>
        );
    }
}
