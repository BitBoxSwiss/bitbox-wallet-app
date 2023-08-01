import React, { ReactChild } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { IAccount } from '../api/account';
import { TDevices } from '../api/devices';
import { AddAccount } from './account/add/add';
import { Moonpay } from './buy/moonpay';
import { BuyInfo } from './buy/info';
import { Exchange } from './buy/exchange';
import { Pocket } from './buy/pocket';
import { Info } from './account/info/info';
import { Receive } from './account/receive';
import { Send } from './account/send/send';
import { AccountsSummary } from './account/summary/accountssummary';
import { DeviceSwitch } from './device/deviceswitch';
import ManageBackups from './device/manage-backups/manage-backups';
import { ManageAccounts } from './settings/manage-accounts';
import { ElectrumSettings } from './settings/electrum';
import { Passphrase } from './device/bitbox02/passphrase';
import { Account } from './account/account';
import { ReceiveAccountsSelector } from './accounts/select-receive';
import { Appearance } from './settings/appearance';
import { MobileSettings } from './settings/mobile-settings';
import { About } from './settings/about';
import { AdvancedSettings } from './settings/advanced-settings';
import { WalletConnect } from './account/walletconnect';

type TAppRouterProps = {
    devices: TDevices;
    deviceIDs: string[];
    accounts: IAccount[];
    activeAccounts: IAccount[];
    devicesKey: ((input: string) => string)
}

type TInjectParamsProps = {
  children: ReactChild;
}

const InjectParams = ({ children }: TInjectParamsProps) => {
  const params = useParams();
  return React.cloneElement(children as React.ReactElement, params);
};

export const AppRouter = ({ devices, deviceIDs, devicesKey, accounts, activeAccounts }: TAppRouterProps) => {
  const hasAccounts = accounts.length > 0;
  const Homepage = <DeviceSwitch
    key={devicesKey('device-switch-default')}
    deviceID={null}
    devices={devices}
    hasAccounts={hasAccounts}
  />;

  const Device = <InjectParams>
    <DeviceSwitch
      key={devicesKey('device-switch')}
      deviceID={null}
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>;

  const Acc = <InjectParams>
    <Account
      code={'' /* dummy to satisfy TS */}
      devices={devices}
      accounts={activeAccounts} />
  </InjectParams>;

  const AccountsSummaryEl = <InjectParams>
    <AccountsSummary
      devices={devices}
      accounts={activeAccounts} />
  </InjectParams>;

  const AccSend = <InjectParams>
    <Send
      code={'' /* dummy to satisfy TS */}
      devices={devices}
      deviceIDs={deviceIDs}
      accounts={activeAccounts} />
  </InjectParams>;

  const AccReceive = <InjectParams>
    <Receive
      code={'' /* dummy to satisfy TS */}
      devices={devices}
      deviceIDs={deviceIDs}
      accounts={activeAccounts} />
  </InjectParams>;

  const AccInfo = <InjectParams>
    <Info
      code={''}
      accounts={activeAccounts} />
  </InjectParams>;

  const AccWalletConnect = <InjectParams>
    <WalletConnect
      code={'' /* dummy to satisfy TS */}
    />
  </InjectParams>;

  const BuyInfoEl = <InjectParams>
    <BuyInfo
      code={''}
      accounts={activeAccounts} />
  </InjectParams>;

  const MoonpayEl = <InjectParams>
    <Moonpay
      code={''}
      accounts={activeAccounts} />
  </InjectParams>;

  const ExchangeEl = <InjectParams>
    <Exchange
      code={''}
      accounts={activeAccounts} />
  </InjectParams>;

  const PocketEl = <InjectParams>
    <Pocket
      code={''} />
  </InjectParams>;

  const PassphraseEl = <InjectParams><Passphrase deviceID={''} /></InjectParams>;

  const ManageBackupsEl = <InjectParams><ManageBackups
    key={devicesKey('manage-backups')}
    devices={devices}
  /></InjectParams>;

  const MobileSettingsEl = <InjectParams>
    <MobileSettings
      deviceIDs={deviceIDs}
      hasAccounts={hasAccounts}

    />
  </InjectParams>;

  const AppearanceEl = <InjectParams>
    <Appearance
      deviceIDs={deviceIDs}
      hasAccounts={hasAccounts}
    />
  </InjectParams>;

  const AboutEl = <InjectParams>
    <About
      deviceIDs={deviceIDs}
      hasAccounts={hasAccounts}
    />
  </InjectParams>;

  const AdvancedSettingsEl = <InjectParams>
    <AdvancedSettings
      deviceIDs={deviceIDs}
      hasAccounts={hasAccounts}
    />
  </InjectParams>;

  const ReceiveAccountsSelectorEl = <InjectParams><ReceiveAccountsSelector activeAccounts={activeAccounts}/></InjectParams>;

  return <Routes>
    <Route path="/">
      <Route index element={Homepage} />
      <Route path="account/:code">
        <Route index element={Acc} />
        <Route path="send" element={AccSend} />
        <Route path="receive" element={AccReceive} />
        <Route path="info" element={AccInfo} />
        <Route path="wallet-connect" element={AccWalletConnect} />
      </Route>
      <Route path="add-account" element={<AddAccount />} />
      <Route path="account-summary" element={AccountsSummaryEl} />
      <Route path="buy">
        <Route path="info" element={BuyInfoEl} >
          <Route index element={BuyInfoEl} />
          <Route path=":code" element={BuyInfoEl} />
        </Route>
        <Route path="moonpay/:code" element={MoonpayEl} />
        <Route path="pocket/:code" element={PocketEl} />
        <Route path="exchange/:code" element={ExchangeEl} />
      </Route>
      <Route path="passphrase/:deviceID" element={PassphraseEl} />
      <Route path="manage-backups/:deviceID" element={ManageBackupsEl} />
      <Route path="accounts/select-receive" element={ReceiveAccountsSelectorEl} />
      <Route path="settings">
        <Route index element={MobileSettingsEl} />
        <Route path="appearance" element={AppearanceEl} />
        <Route path="about" element={AboutEl} />
        <Route path="device-settings/:deviceID" element={Device} />
        <Route path="advanced-settings" element={AdvancedSettingsEl} />
        <Route path="electrum" element={<ElectrumSettings />} />
        <Route path="manage-accounts" element={<ManageAccounts key={'manage-accounts'} deviceIDs={deviceIDs} hasAccounts={hasAccounts}/>} />
      </Route>
    </Route>
  </Routes>;
};
