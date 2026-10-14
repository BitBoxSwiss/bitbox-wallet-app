// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext } from 'react';
import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';
import type { TLightningAccount } from '@/api/lightning';

export type TAppStateContextProps = {
  accounts: TAccount[];
  activeAccounts: TAccount[];
  deviceIDs: string[];
  devices: TDevices;
  hasAccounts: boolean;
  hasBottomNavigation: boolean;
  hasDevices: boolean;
  hasLightningAccount: boolean;
  lightningAccount: TLightningAccount | null | undefined;
};

export const AppStateContext = createContext<TAppStateContextProps | null>(null);

export const useAppState = () => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }

  return context;
};
