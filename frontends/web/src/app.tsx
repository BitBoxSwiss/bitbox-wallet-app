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

import { Component, h, RenderableProps } from 'preact';
import { getCurrentUrl, route } from 'preact-router';
import { Alert } from './components/alert/Alert';
import { Banner } from './components/banner/banner';
import { Confirm } from './components/confirm/Confirm';
import { Container } from './components/container/container';
import { store as panelStore } from './components/guide/guide';
import { toggleSidebar } from './components/sidebar/sidebar';
import { Sidebar } from './components/sidebar/sidebar';
import TranslationHelper from './components/translationhelper/translationhelper';
import { Update } from './components/update/update';
import { translate, TranslateProps } from './decorators/translate';
import { i18nEditorActive } from './i18n/i18n';
import { Account, AccountInterface } from './routes/account/account';
import { AddAccount } from './routes/account/add/addaccount';
import Info from './routes/account/info/info';
import Receive from './routes/account/receive/receive';
import { Send } from './routes/account/send/send';
import { InitializeAllAccounts } from './routes/account/summary/initializeall';
import { BitBoxBase, setBaseUserStatus, setInternalBaseStatus, updateSharedBaseState } from './routes/bitboxbase/bitboxbase';
import { BitBoxBaseConnect, DetectedBitBoxBases } from './routes/bitboxbase/bitboxbaseconnect';
import { Devices, DeviceSwitch } from './routes/device/deviceswitch';
import ManageBackups from './routes/device/manage-backups/manage-backups';
import ElectrumSettings from './routes/settings/electrum';
import Settings from './routes/settings/settings';
import { apiGet, apiPost } from './utils/request';
import { apiWebsocket } from './utils/websocket';

interface State {
    accounts: AccountInterface[];
    accountsInitialized: boolean;
    deviceIDs: string[];
    devices: Devices;
    detectedBases: DetectedBitBoxBases;
    bitboxBaseIDs: string[];
}

type Props = TranslateProps;

class App extends Component<Props, State> {
    public state = {
        accounts: [],
        accountsInitialized: false,
        deviceIDs: [],
        devices: {},
        detectedBases: {},
        bitboxBaseIDs: [],
    };

    private unsubscribe!: () => void;

    /**
     * Gets fired when the route changes.
     */
    private handleRoute = () => {
        if (panelStore.state.activeSidebar) {
            toggleSidebar();
        }
    }

    public componentDidMount() {
        this.onDevicesRegisteredChanged();
        this.onBitBoxBasesRegisteredChanged();
        this.onBitBoxBasesDetectedChanged();
        this.onAccountsStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, meta }) => {
            switch (type) {
            case 'backend':
                switch (data) {
                case 'accountsStatusChanged':
                    this.onAccountsStatusChanged();
                    break;
                case 'newTxs':
                    apiPost('notify-user', {
                        text: this.props.t('notification.newTxs', {
                            count: meta.count,
                            accountName: meta.accountName,
                        }),
                    });
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
            case 'bitboxbases':
                switch (data) {
                case 'registeredChanged':
                    this.onBitBoxBasesRegisteredChanged();
                    break;
                case 'detectedChanged':
                    this.onBitBoxBasesDetectedChanged();
                    break;
                case 'reconnected':
                    this.onBitBoxBaseReconnected(meta.ID);
                    break;
                }
            }
        });
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private onDevicesRegisteredChanged = () => {
        apiGet('devices/registered').then(devices => {
            const deviceIDs = Object.keys(devices);
            this.setState({ devices, deviceIDs });
        });
    }

    private onBitBoxBasesDetectedChanged = () => {
        apiGet('bitboxbases/detected').then(detectedBases => {
            this.setState({ detectedBases });
        });
    }

    private onBitBoxBasesRegisteredChanged = () => {
        apiGet('bitboxbases/registered').then(bases => {
            let bitboxBaseIDs: string[] = [];
            if (bases !== null) {
                // Registered bases are returned in the format {ID: hostname}
                bitboxBaseIDs = Object.keys(bases);
            }
            this.setState({ bitboxBaseIDs });
            bitboxBaseIDs.map(ID => updateSharedBaseState('hostname', bases[ID].split('.')[0], ID));
        });
    }

    private onBitBoxBaseReconnected = (ID: string) => {
        setInternalBaseStatus('locked', ID);
        setBaseUserStatus('OK', ID);
    }

    private onAccountsStatusChanged = () => {
        apiGet('accounts-status').then(status => {
            const accountsInitialized = status === 'initialized';
            const inAccounts = getCurrentUrl().match(/^\/account\//);
            if (!accountsInitialized && inAccounts) {
                route('/', true);
            }
            this.setState({ accountsInitialized });
            apiGet('accounts').then(accounts => {
                this.setState({ accounts });
                if (inAccounts && !accounts.some(account => getCurrentUrl().startsWith('/account/' + account.code))) {
                    route('/', true);
                }

                if (getCurrentUrl().match(/^\/account$/)) {
                    if (accounts && accounts.length) {
                        route(`/account/${accounts[0].code}`, true);
                    }
                }
            });
        });
    }

    private toggleSidebar = () => {
        panelStore.setState({ activeSidebar: !panelStore.state.activeSidebar });
    }

    public render(
        {}: RenderableProps<Props>,
        { accounts, devices, deviceIDs, bitboxBaseIDs, accountsInitialized, detectedBases }: State,
    ) {
        return (
            <div className={['app', i18nEditorActive ? 'i18nEditor' : ''].join(' ')}>
                <TranslationHelper />
                <Sidebar
                    accounts={accounts}
                    deviceIDs={deviceIDs}
                    bitboxBaseIDs={bitboxBaseIDs}
                    accountsInitialized={accountsInitialized} />
                <div class="appContent flex flex-column flex-1" style="min-width: 0;">
                    <Update />
                    <Banner msgKey="bitbox01" />
                    <Container toggleSidebar={this.toggleSidebar} onChange={this.handleRoute}>
                        <Send
                            path="/account/:code/send"
                            devices={devices}
                            deviceIDs={deviceIDs}
                            accounts={accounts} />
                        <Receive
                            path="/account/:code/receive"
                            devices={devices}
                            accounts={accounts}
                            deviceIDs={deviceIDs} />
                        <Info
                            path="/account/:code/info"
                            accounts={accounts} />
                        <Account
                            path="/account/:code"
                            code={'' /* dummy to satisfy TS */}
                            devices={devices}
                            accounts={accounts} />
                        <AddAccount
                            path="/add-account" />
                        <InitializeAllAccounts accounts={accounts}
                            path="/account-summary" />
                        <BitBoxBaseConnect
                          path="/bitboxbase"
                          detectedBases={detectedBases}
                          bitboxBaseIDs={bitboxBaseIDs} />
                        <BitBoxBase
                          path="/bitboxbase/:bitboxBaseID"
                          bitboxBaseID={null} />
                        <ElectrumSettings
                            path="/settings/electrum" />
                        <Settings
                            deviceIDs={deviceIDs}
                            path="/settings" />
                        {/* Use with TypeScript: {Route<{ deviceID: string }>({ path: '/manage-backups/:deviceID', component: ManageBackups })} */}
                        {/* ManageBackups and DeviceSwitch need a key to trigger (re-)mounting when devices change, to handle routing */}
                        <ManageBackups
                            path="/manage-backups/:deviceID/:sdCardInserted?"
                            key={devices}
                            devices={devices}
                        />
                        <DeviceSwitch
                            path="/device/:deviceID"
                            key={devices}
                            deviceID={null /* dummy to satisfy TS */}
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

const HOC = translate()(App);
export { HOC as App };
