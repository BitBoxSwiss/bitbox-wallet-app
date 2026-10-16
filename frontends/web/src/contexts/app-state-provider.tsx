// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useContext, useMemo } from 'react';
import { AppStateContext } from './app-state-context';
import { useSync } from '@/hooks/api';
import { useDefault } from '@/hooks/default';
import { getAccounts } from '@/api/account';
import { getDeviceList } from '@/api/devices';
import { syncAccountsList } from '@/api/accountsync';
import { syncDeviceList } from '@/api/devicessync';
import { getLightningAccount, subscribeLightningAccount } from '@/api/lightning';
import { useLocation } from '@/utils/router-compatability';
import { isLightningFeatureAvailable } from '@/utils/env';
import { AppContext } from './AppContext';
import { shouldShowBottomNavigation } from '@/components/bottom-navigation/utils';

type TProps = {
  children: ReactNode;
};

export const AppStateProvider = ({ children }: TProps) => {

  const { pathname } = useLocation();
  const accounts = useDefault(useSync(getAccounts, syncAccountsList), []);
  const activeAccounts = useMemo(() => accounts.filter(acct => acct.active), [accounts]);

  const devices = useDefault(useSync(getDeviceList, syncDeviceList), {});
  const deviceIDs = useMemo(() => Object.keys(devices), [devices]);
  const hasDevices = deviceIDs.length > 0;

  const lightningFeatureAvailable = isLightningFeatureAvailable();

  const lightningAccount = useSync(
    lightningFeatureAvailable ? getLightningAccount : null,
    lightningFeatureAvailable ? subscribeLightningAccount : null,
  );

  const hasLightningAccount = (
    lightningFeatureAvailable
    && lightningAccount !== undefined
    && lightningAccount !== null
  );

  const { vendorIframeActive } = useContext(AppContext);

  const hasAccounts = activeAccounts.length > 0;

  const hasBottomNavigation = (
    !vendorIframeActive
    && shouldShowBottomNavigation({
      activeAccounts,
      devices,
      hasLightningAccount,
      pathname,
    })
  );

  const value = useMemo(() => ({
    accounts,
    activeAccounts,
    deviceIDs,
    devices,
    hasAccounts,
    hasBottomNavigation,
    hasDevices,
    hasLightningAccount,
    lightningAccount,
  }), [
    accounts,
    activeAccounts,
    deviceIDs,
    devices,
    hasAccounts,
    hasBottomNavigation,
    hasDevices,
    hasLightningAccount,
    lightningAccount,
  ]);

  return (
    <AppStateContext.Provider
      value={value}>
      {children}
    </AppStateContext.Provider>
  );
};
