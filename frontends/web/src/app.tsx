/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { Component, Fragment } from 'react';
import { AppRouter } from './routes/router';
import { Wizard as BitBox02Wizard } from './routes/device/bitbox02/wizard';
import { getAccounts, IAccount } from './api/account';
import { syncAccountsList } from './api/accountsync';
import { getDeviceList, TDevices } from './api/devices';
import { syncDeviceList } from './api/devicessync';
import { syncNewTxs } from './api/transactions';
import { notifyUser } from './api/system';
import { unsubscribe, UnsubscribeList } from './utils/subscriptions';
import { ConnectedApp } from './connected';
import { Alert } from './components/alert/Alert';
import { Aopp } from './components/aopp/aopp';
import { Banner } from './components/banner/banner';
import { Confirm } from './components/confirm/Confirm';
import { KeystoreConnectPrompt } from './components/keystoreconnectprompt';
import { panelStore } from './components/sidebar/sidebar';
import { MobileDataWarning } from './components/mobiledatawarning';
import { Sidebar, toggleSidebar } from './components/sidebar/sidebar';
import { Update } from './components/update/update';
import { translate, TranslateProps } from './decorators/translate';
import { route, RouterWatcher } from './utils/route';
import { Darkmode } from './components/darkmode/darkmode';
import { DarkModeProvider } from './contexts/DarkmodeProvider';
import { AppProvider } from './contexts/AppProvider';
import { AuthRequired } from './components/auth/authrequired';
import { WCWeb3WalletProvider } from './contexts/WCWeb3WalletProvider';
import { WCSigningRequest } from './components/wallet-connect/incoming-signing-request';

type State = {
  accounts: IAccount[];
  devices: TDevices;
}

type Props = TranslateProps;

class App extends Component<Props, State> {
  public readonly state: State = {
    accounts: [],
    devices: {},
  };

  private unsubscribeList: UnsubscribeList = [];

  /**
   * Gets fired when the route changes.
   */
  private handleRoute = () => {
    if (panelStore.state.activeSidebar) {
      toggleSidebar();
    }
  };

  public componentDidMount() {
    Promise.all([getDeviceList(), getAccounts()])
      .then(([devices, accounts]) => {
        this.setStateWithDeviceList({ accounts, devices });
      }).catch(console.error);


    this.unsubscribeList.push(
      syncNewTxs((meta) => {
        notifyUser(this.props.t('notification.newTxs', {
          count: meta.count,
          accountName: meta.accountName,
        }));
      }),
      syncAccountsList(accounts => {
        const oldAccountsLen = this.state.accounts.length;
        this.setState({ accounts }, () => this.maybeRoute(oldAccountsLen));
      }),
      syncDeviceList((devices) => {
        this.setStateWithDeviceList({ devices });
      }),
    );
  }

  private setStateWithDeviceList(newState: Partial<State>) {
    const oldDeviceIDList = Object.keys(this.state.devices);
    const oldAccountsLen = this.state.accounts.length;
    this.setState(currentState => ({ ...currentState, ...newState }), () => {
      const newDeviceIDList: string[] = Object.keys(this.state.devices);
      // If a device is newly connected, we route to the settings.
      if (
        newDeviceIDList.length > 0
        && newDeviceIDList[0] !== oldDeviceIDList[0]
      ) {
        // We only route to settings if it is a bb01 or a bb02 bootloader.
        // The bitbox02 wizard itself is mounted globally (see BitBox02Wizard) so it can be unlocked
        // anywhere at any time.
        // We don't bother implementing the same for the bitbox01.
        // The bb02 bootloader screen is not full screen, so we don't mount it globally and instead
        // route to it.
        const productName = this.state.devices[newDeviceIDList[0]];
        if (productName === 'bitbox' || productName === 'bitbox02-bootloader') {
          route(`settings/device-settings/${newDeviceIDList[0]}`, true);
          return;
        }
      }
      this.maybeRoute(oldAccountsLen);
    });
  }

  public componentWillUnmount() {
    unsubscribe(this.unsubscribeList);
  }

  private maybeRoute = (oldAccountsLen: number) => {
    const currentURL = window.location.pathname;
    const isIndex = currentURL === '/' || currentURL === '/index.html' || currentURL === '/android_asset/web/index.html';
    const inAccounts = currentURL.startsWith('/account/');
    const accounts = this.state.accounts;

    // QT and Android start their apps in '/index.html' and '/android_asset/web/index.html' respectively
    // This re-routes them to '/' so we have a simpler uri structure
    if (isIndex && currentURL !== '/' && (!accounts || accounts.length === 0)) {
      route('/', true);
      return;
    }
    // if no accounts are registered on specified views route to /
    if (accounts.length === 0 && (
      currentURL.startsWith('/account-summary')
      || currentURL.startsWith('/add-account')
      || currentURL.startsWith('/settings/manage-accounts')
    )) {
      route('/', true);
      return;
    }
    // if no devices are registered on specified views route to /
    if (Object.keys(this.state.devices).length === 0 &&
        currentURL.startsWith('/settings/device-settings/')) {
      route('/', true);
      return;
    }
    // if on an account that isnt registered route to /
    if (inAccounts && !accounts.some(account => currentURL.startsWith('/account/' + account.code))) {
      route('/', true);
      return;
    }
    // if on index page and we go from zero accounts to at least 1 account, route to /account-summary
    if (isIndex && oldAccountsLen === 0 && accounts.length) {
      route('/account-summary', true);
      return;
    }
    // if on the /buy/ view and there are no accounts view route to /
    if (accounts.length === 0 && currentURL.startsWith('/buy/')) {
      route('/', true);
      return;
    }
  };

  // Returns a string representation of the current devices, so it can be used in the `key` property of subcomponents.
  // The prefix is used so different subcomponents can have unique keys to not confuse the renderer.
  private devicesKey = (prefix: string): string => {
    return prefix + ':' + JSON.stringify(this.state.devices, Object.keys(this.state.devices).sort());
  };

  private activeAccounts = (): IAccount[] => {
    return this.state.accounts.filter(acct => acct.active);
  };

  public render() {
    const { accounts, devices } = this.state;
    const deviceIDs: string[] = Object.keys(devices);
    const activeAccounts = this.activeAccounts();
    return (
      <ConnectedApp>
        <AppProvider>
          <DarkModeProvider>
            <WCWeb3WalletProvider>
              <Darkmode />
              <div className="app">
                <AuthRequired/>
                <Sidebar
                  accounts={activeAccounts}
                  deviceIDs={deviceIDs}
                />
                <div className="appContent flex flex-column flex-1" style={{ minWidth: 0 }}>
                  <Update />
                  <Banner msgKey="bitbox01" />
                  <Banner msgKey="bitbox02" />
                  <MobileDataWarning />
                  <WCSigningRequest />
                  <Aopp />
                  <KeystoreConnectPrompt />
                  {
                    Object.entries(devices).map(([deviceID, productName]) => {
                      if (productName === 'bitbox02') {
                        return (
                          <Fragment key={deviceID}>
                            <BitBox02Wizard
                              deviceID={deviceID}
                            />
                          </Fragment>
                        );
                      }
                      return null;
                    })
                  }
                  <AppRouter
                    accounts={accounts}
                    activeAccounts={activeAccounts}
                    deviceIDs={deviceIDs}
                    devices={devices}
                    devicesKey={this.devicesKey}
                  />
                  <RouterWatcher onChange={this.handleRoute} />
                </div>
                <Alert />
                <Confirm />
              </div>
            </WCWeb3WalletProvider>
          </DarkModeProvider>
        </AppProvider>
      </ConnectedApp>
    );
  }
}

const HOC = translate()(App);
export { HOC as App };
