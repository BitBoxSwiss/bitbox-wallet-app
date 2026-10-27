// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { AppStateContext } from '@/contexts/app-state-context';
import { AttestationWarnings } from './attestation';

export const FullscreenBanners = () => {
  const appState = useContext(AppStateContext);
  return appState ? <AttestationWarnings devices={appState.devices} /> : null;
};
