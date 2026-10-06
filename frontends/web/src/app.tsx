// SPDX-License-Identifier: Apache-2.0

import { useContext, useMemo, Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import { useIgnoreDrop } from './hooks/drop';
import { usePlatformClass } from './hooks/platform';
import { useAppReady } from './hooks/appready';
import { AppRouter } from './routes/router';
import { Wizard as BitBox02Wizard } from './routes/device/bitbox02/wizard';
import { ConnectedApp } from './connected';
import { Alert } from './components/alert/Alert';
import { AppNavigation } from './components/navigation';
import { AppNotifications } from './components/notification';
import { Aopp } from './components/aopp/aopp';
import { Confirm } from './components/confirm/Confirm';
import { KeystoreConnectPrompt } from './components/keystoreconnectprompt';
import { Sidebar } from './components/sidebar/sidebar';
import { RouterWatcher } from './utils/route';
import { Darkmode } from './components/darkmode/darkmode';
import { AuthRequired } from './components/auth/authrequired';
import { WCSigningRequest } from './components/wallet-connect/incoming-signing-request';
import { GlobalBannersProvider } from './contexts/global-banners-provider';
import { Providers } from './contexts/providers';
import { AppContext } from './contexts/AppContext';
import { useAppState } from './contexts/app-state-context';
import { BottomNavigation } from './components/bottom-navigation/bottom-navigation';
import { getBottomNavKey } from './components/bottom-navigation/utils';
import styles from './app.module.css';

const AppFrame = () => {

  const { pathname } = useLocation();

  const { vendorIframeActive } = useContext(AppContext);

  const {
    accounts,
    activeAccounts,
    devices,
    hasBottomNavigation,
    hasLightningAccount,
  } = useAppState();

  const tabKey = useMemo(() => getBottomNavKey(pathname), [pathname]);

  return (
    <>
      <Darkmode />
      <div className="app">
        <AuthRequired/>
        <Sidebar
          accounts={activeAccounts}
          devices={devices}
        />
        <div className={`
          ${styles.appContent || ''}
          ${hasBottomNavigation && styles.hasBottomNavigation || ''}
          ${vendorIframeActive && styles.hasMarketIframe || ''}
        `}>
          <WCSigningRequest accounts={accounts} />
          <Aopp />
          <KeystoreConnectPrompt />
          {
            Object.entries(devices).map(([deviceID, platformName]) => {
              if (platformName === 'bitbox02') {
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
          <GlobalBannersProvider devices={devices}>
            {/* Remount on tab changes to restart the tab transition animation. */}
            <div key={tabKey} className={styles.tabTransition}>
              <AppRouter />
            </div>
          </GlobalBannersProvider>
          <RouterWatcher />
        </div>
        {hasBottomNavigation && (
          <BottomNavigation
            devices={devices}
            activeAccounts={activeAccounts}
            hasLightningAccount={hasLightningAccount}
          />
        )}
        <Alert />
        <Confirm />
      </div>
    </>
  );
};

export const App = () => {
  usePlatformClass();
  useIgnoreDrop();
  useAppReady();

  return (
    <ConnectedApp>
      <Providers>
        <AppNavigation />
        <AppNotifications />
        <AppFrame />
      </Providers>
    </ConnectedApp>
  );
};
