// SPDX-License-Identifier: Apache-2.0

import { Route, Switch } from 'wouter';
import { useDevicesKey } from '@/hooks/device-key';
import { Navigate, Routes, useLocation } from '@/utils/router-compatability';
import { AddAccount } from './account/add/add-account';
import { Moonpay } from './market/moonpay';
import { Market } from './market/market';
import { MarketProvider } from './market/market-context';
import { Pocket } from './market/pocket';
import { BTCDirect } from './market/btcdirect';
import { BTCDirectOTC } from './market/btcdirect-otc';
import { PocketOTC } from './market/pocket-otc';
import { Bitrefill } from './market/bitrefill';
import { Swap } from './market/swap/swap';
import { Info } from './account/info/info';
import { XPubDetail } from './account/info/xpub-detail';
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
import { LightningSettings } from './settings/lightning-settings';
import { Bitsurance } from './bitsurance/bitsurance';
import { BitsuranceAccount } from './bitsurance/account';
import { BitsuranceWidget } from './bitsurance/widget';
import { BitsuranceDashboard } from './bitsurance/dashboard';
import { ConnectScreenWalletConnect } from './account/walletconnect/connect';
import { DashboardWalletConnect } from './account/walletconnect/dashboard';
import { AllAccounts } from '@/routes/accounts/all-accounts';
import { Lightning } from './lightning/lightning';
import { LightningActivate } from './lightning/activate';
import { LightningDisclaimer } from './lightning/disclaimer';
import { LightningDeactivate } from './lightning/deactivate';
import { LightningSetLnurlAddress } from './lightning/set-lnurl-address';
import { Send as LightningSend } from './lightning/send/send';
import { Receive as LightningReceive } from './lightning/receive/receive';
import { LightningTopUp } from './lightning/topup/topup';
import { LightningClaimTopUp } from './lightning/claim-top-up/claim-top-up';
import { LightningCloseWithdrawFunds } from './lightning/close-and-withdraw-funds/close-withdraw-funds';
import { isLightningFeatureAvailable } from '@/utils/env';
import { isLightningRoute } from '@/utils/route';
import { LightningTestnetGuard } from './lightning/testnet-warning';

const DeviceSwitchWithKey = () => {
  const key = useDevicesKey('device-switch-default');
  return (
    <DeviceSwitch key={key} />
  );
};

const ManageBackupsWithKey = () => {
  const key = useDevicesKey('manage-backups');
  return (
    <ManageBackups key={key} />
  );
};

const DeviceSettingsWithKey = () => {
  const key = useDevicesKey('device-switch');
  return (
    <DeviceSwitch key={key} />
  );
};

export const AppRouter = () => {

  const lightningFeatureAvailable = isLightningFeatureAvailable();
  const { pathname } = useLocation();

  return (
    <LightningTestnetGuard active={lightningFeatureAvailable && isLightningRoute(pathname)}>
      <Routes>
        <Route path="/" component={DeviceSwitchWithKey}/>
        <Route path="/account/:code" component={Account}/>
        <Route path="/account/:code/send" component={SendWrapper}/>
        <Route path="/account/:code/receive" component={Receive}/>
        <Route path="/account/:code/addresses/:addressID" component={Addresses}/>
        <Route path="/account/:code/addresses/:addressID/verify" component={Addresses}/>
        <Route path="/account/:code/addresses" component={Addresses}/>
        <Route path="/account/:code/addresses/:addressID/sign-message" component={SignMessage}/>
        <Route path="/account/:code/info" component={Info}/>
        <Route path="/account/:code/info/xpub-detail" component={XPubDetail}/>
        <Route path="/account/:code/sign-message/:view" component={SignMessage}/>
        <Route path="/account/:code/wallet-connect/connect" component={ConnectScreenWalletConnect}/>
        <Route path="/account/:code/wallet-connect/dashboard" component={DashboardWalletConnect}/>

        <Route path="/add-account" component={AddAccount}/>
        <Route path="/account-summary" component={AccountsSummary}/>
        <Route path="/market/btcdirect/buy/:code" component={() => <BTCDirect action="buy"/>}/>
        <Route path="/market/btcdirect/buy/:code/:region" component={() => <BTCDirect action="buy"/>}/>
        <Route path="/market/btcdirect/sell/:code" component={() => <BTCDirect action="sell"/>}/>
        <Route path="/market/btcdirect/sell/:code/:region" component={() => <BTCDirect action="sell"/>}/>
        <Route path="/market/bitrefill/spend/:code" component={Bitrefill}/>
        <Route path="/market/bitrefill/spend/:code/:region" component={Bitrefill}/>
        <Route path="/market/moonpay/buy/:code" component={Moonpay}/>
        <Route path="/market/moonpay/buy/:code/:region" component={Moonpay}/>
        <Route path="/market/pocket/buy/:code" component={() => <Pocket action="buy"/>}/>
        <Route path="/market/pocket/buy/:code/:region" component={() => <Pocket action="buy"/>}/>
        <Route path="/market/pocket/sell/:code" component={() => <Pocket action="sell"/>}/>
        <Route path="/market/pocket/sell/:code/:region" component={() => <Pocket action="sell"/>}/>
        <Route path="/market/btcdirect-otc" component={BTCDirectOTC}/>
        <Route path="/market/pocket-otc" component={PocketOTC}/>
        <Route path="/market/swap" component={Swap}/>
        <Route path="/market/*" component={() => (
          <MarketProvider>
            <Switch>
              <Route path="/market/select" component={Market}/>
              <Route path="/market/select/:code" component={Market}/>
              <Route path="/market/bitsurance/widget/:code" component={BitsuranceWidget}/>
              <Route path="/market/bitsurance/:code" component={Bitsurance}/>
              <Route path="/market/bitsurance/account/:code" component={BitsuranceAccount}/>
              <Route path="/market/bitsurance/dashboard/:code" component={BitsuranceDashboard}/>
            </Switch>
          </MarketProvider>
        )} />
        {lightningFeatureAvailable ? (
          <>
            <Route path="/lightning" component={Lightning}/>
            <Route path="/lightning/activate" component={LightningActivate}/>
            <Route path="/lightning/disclaimer" component={LightningDisclaimer}/>
            <Route path="/lightning/deactivate" component={LightningDeactivate}/>
            <Route path="/lightning/set-lnurl-address" component={LightningSetLnurlAddress}/>
            <Route path="/lightning/claim-top-up" component={LightningClaimTopUp}/>
            <Route path="/lightning/close-withdraw-funds" component={LightningCloseWithdrawFunds}/>
            <Route path="/lightning/send" component={LightningSend}/>
            <Route path="/lightning/receive" component={LightningReceive}/>
            <Route path="/lightning/topup" component={LightningTopUp}/>
          </>
        ) : (
          <Route path="/lightning/*" component={() => <Navigate replace to="/"/>}/>
        )}
        <Route path="/manage-backups/:deviceID" component={ManageBackupsWithKey}/>
        <Route path="/accounts/select-receive" component={ReceiveAccountsSelector}/>
        <Route path="/accounts/all" component={AllAccounts}/>
        <Route path="/settings" component={MobileSettings}/>
        <Route path="/settings/more" component={() => (
          <Navigate replace to="/settings"/>
        )}/>
        <Route path="/settings/general" component={General}/>
        <Route path="/settings/about" component={About}/>
        <Route path="/settings/device-settings/:deviceID" component={DeviceSettingsWithKey}/>
        <Route path="/settings/no-device-connected" component={() => (
          <NoDeviceConnected key="no-device-connected"/>
        )}/>
        <Route path="/settings/no-accounts" component={() => (
          <NoDeviceConnected key="no-accounts"/>
        )}/>
        <Route path="/settings/device-settings/passphrase/:deviceID" component={Passphrase}/>
        <Route path="/settings/device-settings/recovery-words/:deviceID" component={RecoveryWords}/>
        <Route path="/settings/device-settings/bip85/:deviceID" component={Bip85}/>
        <Route path="/settings/advanced-settings" component={AdvancedSettings}/>
        <Route
          path="/settings/lightning-settings"
          component={() => lightningFeatureAvailable
            ? <LightningSettings/>
            : <Navigate replace to="/settings/advanced-settings"/>}/>
        <Route path="/settings/electrum" component={ElectrumSettings}/>
        <Route path="/settings/manage-accounts" component={() => (
          <ManageAccounts key="manage-accounts"/>
        )}/>
      </Routes>
    </LightningTestnetGuard>
  );
};
