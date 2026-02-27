// SPDX-License-Identifier: Apache-2.0

import React, { ReactChild } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { TAccount } from '@/api/account';
import { TDevices } from '@/api/devices';
import { AddAccount } from './account/add/add-account';
import { Moonpay } from './market/moonpay';
import { MarketInfo } from './market/info';
import { Market } from './market/market';
import { Pocket } from './market/pocket';
import { BTCDirect } from './market/btcdirect';
import { BTCDirectOTC } from './market/btcdirect-otc';
import { Bitrefill } from './market/bitrefill';
import { Info } from './account/info/info';
import { Receive } from './account/receive/receive';
import { Addresses } from './account/addresses/addresses';
import { SignMessage } from './account/sign-message/sign-message';
import { SendWrapper } from './account/send/send-wrapper';
import { AccountsSummary } from './account/summary/accountssummary';
import { DeviceSwitch } from './device/deviceswitch';
import { NoDeviceConnected } from './device/no-device-connected';
import { ManageBackups } from './device/manage-backups/manage-backups';
import { ManageAccounts } from './settings/manage-accounts';
import { ElectrumSettings } from './settings/electrum';
import { Passphrase } from './device/bitbox02/passphrase';
import { RecoveryWords } from './device/bitbox02/recovery-words';
import { Bip85 } from './device/bitbox02/bip85';
import { Account } from './account/account';
import { ReceiveAccountsSelector } from './accounts/select-receive';
import { General } from './settings/general';
import { MobileSettings } from './settings/mobile-settings';
import { About } from './settings/about';
import { AdvancedSettings } from './settings/advanced-settings';
import { Bitsurance } from './bitsurance/bitsurance';
import { BitsuranceAccount } from './bitsurance/account';
import { BitsuranceWidget } from './bitsurance/widget';
import { BitsuranceDashboard } from './bitsurance/dashboard';
import { ConnectScreenWalletConnect } from './account/walletconnect/connect';
import { DashboardWalletConnect } from './account/walletconnect/dashboard';
import { AllAccounts } from '@/routes/accounts/all-accounts';
import { More } from '@/routes/settings/more';

type TAppRouterProps = {
  devices: TDevices;
  accounts: TAccount[];
  activeAccounts: TAccount[];
  devicesKey: ((input: string) => string);
};

type TInjectParamsProps = {
  children: ReactChild;
};

const InjectParams = ({ children }: TInjectParamsProps) => {
  const params = useParams();
  return React.cloneElement(children as React.ReactElement, params);
};

export const AppRouter = ({ devices, devicesKey, accounts, activeAccounts }: TAppRouterProps) => {
  const hasAccounts = accounts.length > 0;
  const Homepage = (<DeviceSwitch
    key={devicesKey('device-switch-default')}
    deviceID={null}
    devices={devices}
    hasAccounts={hasAccounts}
  />);

  const Device = (<InjectParams>
    <DeviceSwitch
      key={devicesKey('device-switch')}
      deviceID={null}
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>);

  const NoDevice = (
    <InjectParams>
      <NoDeviceConnected
        key="no-device-connected"
        devices={devices}
        hasAccounts={hasAccounts}
      />
    </InjectParams>
  );

  const Acc = (<InjectParams>
    <Account
      code={'' /* dummy to satisfy TS */}
      devices={devices}
      accounts={activeAccounts} />
  </InjectParams>);

  const AccountsSummaryEl = (<InjectParams>
    <AccountsSummary
      devices={devices}
      accounts={activeAccounts} />
  </InjectParams>);

  const AccSend = (<InjectParams>
    <SendWrapper
      code={'' /* dummy to satisfy TS */}
      activeAccounts={activeAccounts}
    />
  </InjectParams>);

  const AccReceive = (<InjectParams>
    <Receive
      code={'' /* dummy to satisfy TS */}
      accounts={activeAccounts} />
  </InjectParams>);

  const AccInfo = (<InjectParams>
    <Info
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const AccAddresses = (<InjectParams>
    <Addresses
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const AccSignMessage = (<InjectParams>
    <SignMessage
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const BitsuranceAccountEl = (<InjectParams>
    <BitsuranceAccount
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const BitsuranceWidgetEl = (<InjectParams>
    <BitsuranceWidget
      code={''} />
  </InjectParams>);

  const AccDashboardWC = (<InjectParams>
    <DashboardWalletConnect
      accounts={activeAccounts}
      code={''}
    />
  </InjectParams>);

  const AccConnectScreenWC = (<InjectParams>
    <ConnectScreenWalletConnect
      code={'' /* dummy to satisfy TS */}
      accounts={activeAccounts}
    />
  </InjectParams>);

  const MarketInfoEl = (<InjectParams>
    <MarketInfo
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const MoonpayEl = (<InjectParams>
    <Moonpay
      code={''}
      accounts={activeAccounts} />
  </InjectParams>);

  const BTCDirectBuyEl = (<InjectParams>
    <BTCDirect
      accounts={activeAccounts}
      action="buy"
      code={''} />
  </InjectParams>);

  const BTCDirectSellEl = (<InjectParams>
    <BTCDirect
      accounts={activeAccounts}
      action="sell"
      code={''} />
  </InjectParams>);

  const BitrefillEl = (<InjectParams>
    <Bitrefill
      code={''}
      accounts={activeAccounts}
      region={''} />
  </InjectParams>);

  const MarketEl = (<InjectParams>
    <Market
      accounts={activeAccounts}
      code={''}
    />
  </InjectParams>);

  const PocketBuyEl = (<InjectParams>
    <Pocket
      action="buy"
      code={''}
    />
  </InjectParams>);

  const PocketSellEl = (<InjectParams>
    <Pocket
      action="sell"
      code={''}
    />
  </InjectParams>);

  const PassphraseEl = <InjectParams><Passphrase deviceID={''} /></InjectParams>;
  const RecoveryWordsEl = <InjectParams><RecoveryWords deviceID={''} /></InjectParams>;
  const Bip85El = <InjectParams><Bip85 deviceID={''} /></InjectParams>;

  const ManageBackupsEl = (<InjectParams><ManageBackups
    key={devicesKey('manage-backups')}
    deviceID={null}
    devices={devices}
  /></InjectParams>);

  const MobileSettingsEl = (<InjectParams>
    <MobileSettings
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>);

  const MoreEl = (<InjectParams>
    <More devices={devices} />
  </InjectParams>);

  const GeneralEl = (<InjectParams>
    <General
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>);

  const AboutEl = (<InjectParams>
    <About
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>);

  const AdvancedSettingsEl = (<InjectParams>
    <AdvancedSettings
      devices={devices}
      hasAccounts={hasAccounts}
    />
  </InjectParams>);

  const ReceiveAccountsSelectorEl = <InjectParams><ReceiveAccountsSelector activeAccounts={activeAccounts}/></InjectParams>;

  const AllAccountsEl = <InjectParams><AllAccounts accounts={activeAccounts} /></InjectParams>;

  return (
    <Routes>
      <Route path="/">
        <Route index element={Homepage} />
        <Route path="account/:code">
          <Route index element={Acc} />
          <Route path="send" element={AccSend} />
          <Route path="receive" element={AccReceive} />
          <Route path="addresses" element={AccAddresses} />
          <Route path="addresses/:addressID" element={AccAddresses} />
          <Route path="addresses/:addressID/verify" element={AccAddresses} />
          <Route path="addresses/:addressID/sign-message" element={AccSignMessage} />
          <Route path="info" element={AccInfo} />
          <Route path="sign-message" element={AccSignMessage} />
          <Route path="wallet-connect/connect" element={AccConnectScreenWC} />
          <Route path="wallet-connect/dashboard" element={AccDashboardWC} />
        </Route>
        <Route path="add-account" element={<AddAccount accounts={accounts}/>} />
        <Route path="account-summary" element={AccountsSummaryEl} />
        <Route path="market">
          <Route path="info" element={MarketInfoEl} >
            <Route index element={MarketInfoEl} />
            <Route path=":code" element={MarketInfoEl} />
          </Route>
          <Route path="btcdirect/buy/:code" element={BTCDirectBuyEl} />
          <Route path="btcdirect/buy/:code/:region" element={BTCDirectBuyEl} />
          <Route path="btcdirect/sell/:code" element={BTCDirectSellEl} />
          <Route path="btcdirect/sell/:code/:region" element={BTCDirectSellEl} />
          <Route path="bitrefill/spend/:code" element={BitrefillEl} />
          <Route path="bitrefill/spend/:code/:region" element={BitrefillEl} />
          <Route path="moonpay/buy/:code" element={MoonpayEl} />
          <Route path="moonpay/buy/:code/:region" element={MoonpayEl} />
          <Route path="pocket/buy/:code" element={PocketBuyEl} />
          <Route path="pocket/buy/:code/:region" element={PocketBuyEl} />
          <Route path="pocket/sell/:code" element={PocketSellEl} />
          <Route path="pocket/sell/:code/:region" element={PocketSellEl} />
          <Route path="select/:code" element={MarketEl} />
          <Route path="btcdirect-otc" element={<BTCDirectOTC/>} />
        </Route>
        <Route path="manage-backups/:deviceID" element={ManageBackupsEl} />
        <Route path="accounts/select-receive" element={ReceiveAccountsSelectorEl} />
        <Route path="accounts/all" element={AllAccountsEl} />
        <Route path="bitsurance">
          <Route path="bitsurance" element={<Bitsurance accounts={activeAccounts}/>}/>
          <Route path="account" element={BitsuranceAccountEl} >
            <Route index element={BitsuranceAccountEl} />
            <Route path=":code" element={BitsuranceAccountEl} />
          </Route>
          <Route path="widget" element={BitsuranceWidgetEl} >
            <Route index element={BitsuranceWidgetEl} />
            <Route path=":code" element={BitsuranceWidgetEl} />
          </Route>
          <Route path="dashboard" element={<BitsuranceDashboard accounts={activeAccounts}/>}/>
        </Route>
        <Route path="settings">
          <Route index element={MobileSettingsEl} />
          <Route path="more" element={MoreEl} />
          <Route path="general" element={GeneralEl} />
          <Route path="about" element={AboutEl} />
          <Route path="device-settings/:deviceID" element={Device} />
          <Route path="no-device-connected" element={NoDevice} />
          <Route path="no-accounts" element={NoDevice} />
          <Route path="device-settings/passphrase/:deviceID" element={PassphraseEl} />
          <Route path="device-settings/recovery-words/:deviceID" element={RecoveryWordsEl} />
          <Route path="device-settings/bip85/:deviceID" element={Bip85El} />
          <Route path="advanced-settings" element={AdvancedSettingsEl} />
          <Route path="electrum" element={<ElectrumSettings />} />
          <Route path="manage-accounts" element={
            <ManageAccounts
              accounts={accounts}
              key="manage-accounts"
              devices={devices}
              hasAccounts={hasAccounts} />
          } />
        </Route>
      </Route>
    </Routes>
  );
};
