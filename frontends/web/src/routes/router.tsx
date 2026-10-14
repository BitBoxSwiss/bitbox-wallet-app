// SPDX-License-Identifier: Apache-2.0

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDevicesKey } from '@/hooks/device-key';
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

export const AppRouter = () => {

  const lightningFeatureAvailable = isLightningFeatureAvailable();
  const { pathname } = useLocation();

  return (
    <LightningTestnetGuard active={lightningFeatureAvailable && isLightningRoute(pathname)}>
      <Routes>
        <Route path="/">
          <Route index element={<DeviceSwitch key={useDevicesKey('device-switch-default')} />} />
          <Route path="account/:code">
            <Route index element={<Account />} />
            <Route path="send" element={<SendWrapper />} />
            <Route path="receive" element={<Receive />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="addresses/:addressID" element={<Addresses />} />
            <Route path="addresses/:addressID/verify" element={<Addresses />} />
            <Route path="addresses/:addressID/sign-message" element={<SignMessage />} />
            <Route path="info" element={<Info />} />
            <Route path="info/xpub-detail" element={<XPubDetail />} />
            <Route path="sign-message/:view" element={<SignMessage />} />
            <Route path="wallet-connect/connect" element={<ConnectScreenWalletConnect />} />
            <Route path="wallet-connect/dashboard" element={<DashboardWalletConnect />} />
          </Route>
          <Route path="add-account" element={<AddAccount />} />
          <Route path="account-summary" element={<AccountsSummary />} />
          <Route path="market/*" element={
            <MarketProvider>
              <Routes>
                <Route path="select" element={<Market />} />
                <Route path="select/:code" element={<Market />} />
                <Route path="bitsurance/widget/:code" element={<BitsuranceWidget />} />
                <Route path="bitsurance">
                  <Route path=":code" element={<Bitsurance />} />
                  <Route path="account/:code" element={<BitsuranceAccount />} />
                  <Route path="dashboard/:code" element={<BitsuranceDashboard />} />
                </Route>
              </Routes>
            </MarketProvider>
          } />
          <Route path="market">
            <Route path="btcdirect/buy/:code" element={<BTCDirect action="buy" />} />
            <Route path="btcdirect/buy/:code/:region" element={<BTCDirect action="buy" />} />
            <Route path="btcdirect/sell/:code" element={ <BTCDirect action="sell" />} />
            <Route path="btcdirect/sell/:code/:region" element={ <BTCDirect action="sell" />} />
            <Route path="bitrefill/spend/:code" element={<Bitrefill />} />
            <Route path="bitrefill/spend/:code/:region" element={<Bitrefill />} />
            <Route path="moonpay/buy/:code" element={<Moonpay />} />
            <Route path="moonpay/buy/:code/:region" element={<Moonpay />} />
            <Route path="pocket/buy/:code" element={<Pocket action="buy" />} />
            <Route path="pocket/buy/:code/:region" element={<Pocket action="buy" />} />
            <Route path="pocket/sell/:code" element={<Pocket action="sell" />} />
            <Route path="pocket/sell/:code/:region" element={<Pocket action="sell" />} />
            <Route path="btcdirect-otc" element={<BTCDirectOTC/>} />
            <Route path="pocket-otc" element={<PocketOTC/>} />
            <Route path="swap" element={<Swap />} />
          </Route>
          {lightningFeatureAvailable ? (
            <Route path="lightning">
              <Route index element={<Lightning />} />
              <Route path="activate" element={<LightningActivate />} />
              <Route path="disclaimer" element={<LightningDisclaimer />} />
              <Route path="deactivate" element={<LightningDeactivate />} />
              <Route path="set-lnurl-address" element={<LightningSetLnurlAddress />} />
              <Route path="claim-top-up" element={<LightningClaimTopUp />} />
              <Route path="close-withdraw-funds" element={(
                <LightningCloseWithdrawFunds />
              )} />
              <Route path="send" element={<LightningSend />} />
              <Route path="receive" element={<LightningReceive />} />
              <Route path="topup" element={<LightningTopUp />} />
            </Route>
          ) : (
            <Route path="lightning/*" element={<Navigate replace to="/" />} />
          )}
          <Route path="manage-backups/:deviceID" element={<ManageBackups key={useDevicesKey('manage-backups')} />} />
          <Route path="accounts/select-receive" element={<ReceiveAccountsSelector />} />
          <Route path="accounts/all" element={<AllAccounts />} />
          <Route path="settings">
            <Route index element={<MobileSettings />} />
            <Route path="more" element={<Navigate replace to="/settings" />} />
            <Route path="general" element={<General />} />
            <Route path="about" element={<About />} />
            <Route path="device-settings/:deviceID" element={<DeviceSwitch key={useDevicesKey('device-switch')} />} />
            <Route path="no-device-connected" element={<NoDeviceConnected key="no-device-connected" />} />
            <Route path="no-accounts" element={<NoDeviceConnected key="no-accounts" />} />
            <Route path="device-settings/passphrase/:deviceID" element={<Passphrase />} />
            <Route path="device-settings/recovery-words/:deviceID" element={<RecoveryWords />} />
            <Route path="device-settings/bip85/:deviceID" element={<Bip85 />} />
            <Route path="advanced-settings" element={<AdvancedSettings />} />
            <Route
              path="lightning-settings"
              element={lightningFeatureAvailable
                ? <LightningSettings />
                : <Navigate replace to="/settings/advanced-settings" />}
            />
            <Route path="electrum" element={<ElectrumSettings />} />
            <Route path="manage-accounts" element={
              <ManageAccounts key="manage-accounts" />
            } />
          </Route>
        </Route>
      </Routes>
    </LightningTestnetGuard>
  );
};
