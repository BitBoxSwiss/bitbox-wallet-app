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
  const Homepage = (
    <DeviceSwitch
      key={useDevicesKey('device-switch-default')}
      deviceID={null}
    />);

  const Device = (
    <DeviceSwitch
      key={useDevicesKey('device-switch')}
      deviceID={null}
    />
  );

  const NoDevice = (
    <NoDeviceConnected key="no-device-connected" />
  );

  const NoAccounts = (
    <NoDeviceConnected key="no-accounts" />
  );

  const Acc = (
    <Account code={'' /* dummy to satisfy TS */} />
  );

  const AccountsSummaryEl = (
    <AccountsSummary />
  );

  const AccSend = (
    <SendWrapper code={'' /* dummy to satisfy TS */} />
  );

  const AccReceive = (
    <Receive code={'' /* dummy to satisfy TS */} />
  );

  const AccInfo = (
    <Info code={''} />
  );

  const AccXPubDetail = (
    <XPubDetail code={''} />
  );

  const AccAddresses = (
    <Addresses code={''} />
  );

  const AccSignMessage = (
    <SignMessage
      code={''}
      view="new" />
  );

  const BitsuranceAccountEl = (
    <BitsuranceAccount code={''} />
  );

  const BitsuranceWidgetEl = (
    <BitsuranceWidget code={''} />
  );

  const BitsuranceIntroEl = (
    <Bitsurance code={''} />
  );

  const BitsuranceDashboardRouteEl = (
    <BitsuranceDashboard code={''} />
  );

  const AccDashboardWC = (
    <DashboardWalletConnect code={''} />
  );

  const AccConnectScreenWC = (
    <ConnectScreenWalletConnect code={'' /* dummy to satisfy TS */} />
  );

  const MoonpayEl = (
    <Moonpay code={''} />
  );

  const BTCDirectBuyEl = (
    <BTCDirect action="buy" code={''} />
  );

  const BTCDirectSellEl = (
    <BTCDirect action="sell" code={''} />
  );

  const BitrefillEl = (
    <Bitrefill code={''} region={''} />
  );

  const SwapEl = (
    <Swap />
  );

  const MarketEl = (
    <Market code={''} />
  );

  const PocketBuyEl = (
    <Pocket action="buy" code={''} />
  );

  const PocketSellEl = (
    <Pocket action="sell" code={''} />
  );

  const PassphraseEl = (
    <Passphrase deviceID={''} />
  );

  const RecoveryWordsEl = (
    <RecoveryWords deviceID={''} />
  );
  const Bip85El = (
    <Bip85 deviceID={''} />
  );

  const ManageBackupsEl = (
    <ManageBackups
      key={useDevicesKey('manage-backups')}
      deviceID={null}
    />
  );

  const MobileSettingsEl = (
    <MobileSettings />
  );

  const GeneralEl = (
    <General />
  );

  const AboutEl = (
    <About />
  );

  const AdvancedSettingsEl = (
    <AdvancedSettings />
  );

  const ReceiveAccountsSelectorEl = (
    <ReceiveAccountsSelector />
  );

  const AllAccountsEl = (
    <AllAccounts />
  );

  const routes = (
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
          <Route path="info/xpub-detail" element={AccXPubDetail} />
          <Route path="sign-message/:view" element={AccSignMessage} />
          <Route path="wallet-connect/connect" element={AccConnectScreenWC} />
          <Route path="wallet-connect/dashboard" element={AccDashboardWC} />
        </Route>
        <Route path="add-account" element={<AddAccount />} />
        <Route path="account-summary" element={AccountsSummaryEl} />
        <Route path="market/*" element={
          <MarketProvider>
            <Routes>
              <Route path="select" element={MarketEl} />
              <Route path="select/:code" element={MarketEl} />
              <Route path="bitsurance/widget/:code" element={BitsuranceWidgetEl} />
              <Route path="bitsurance">
                <Route path=":code" element={BitsuranceIntroEl} />
                <Route path="account/:code" element={BitsuranceAccountEl} />
                <Route path="dashboard/:code" element={BitsuranceDashboardRouteEl} />
              </Route>
            </Routes>
          </MarketProvider>
        } />
        <Route path="market">
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
          <Route path="btcdirect-otc" element={<BTCDirectOTC/>} />
          <Route path="pocket-otc" element={<PocketOTC/>} />
          <Route path="swap" element={SwapEl} />
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
        <Route path="manage-backups/:deviceID" element={ManageBackupsEl} />
        <Route path="accounts/select-receive" element={ReceiveAccountsSelectorEl} />
        <Route path="accounts/all" element={AllAccountsEl} />
        <Route path="settings">
          <Route index element={MobileSettingsEl} />
          <Route path="more" element={<Navigate replace to="/settings" />} />
          <Route path="general" element={GeneralEl} />
          <Route path="about" element={AboutEl} />
          <Route path="device-settings/:deviceID" element={Device} />
          <Route path="no-device-connected" element={NoDevice} />
          <Route path="no-accounts" element={NoAccounts} />
          <Route path="device-settings/passphrase/:deviceID" element={PassphraseEl} />
          <Route path="device-settings/recovery-words/:deviceID" element={RecoveryWordsEl} />
          <Route path="device-settings/bip85/:deviceID" element={Bip85El} />
          <Route path="advanced-settings" element={AdvancedSettingsEl} />
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
  );

  return (
    <LightningTestnetGuard active={lightningFeatureAvailable && isLightningRoute(pathname)}>
      {routes}
    </LightningTestnetGuard>
  );
};
