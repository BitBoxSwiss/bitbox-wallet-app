// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { DarkModeProvider } from './DarkmodeProvider';
import { AppProvider } from './AppProvider';
import { BackButtonProvider } from './BackButtonContext';
import { BackNavigationProvider } from './BackNavigationContext';
import { WCWeb3WalletProvider } from './WCWeb3WalletProvider';
import { RatesProvider } from './RatesProvider';
import { LocalizationProvider } from './localization-provider';
import { ToastProvider } from './toast-provider';

type Props = {
  children: ReactNode;
};

export const Providers = ({ children }: Props) => {
  return (
    <AppProvider>
      <BackNavigationProvider>
        <BackButtonProvider>
          <DarkModeProvider>
            <LocalizationProvider>
              <RatesProvider>
                <ToastProvider>
                  <WCWeb3WalletProvider>
                    {children}
                  </WCWeb3WalletProvider>
                </ToastProvider>
              </RatesProvider>
            </LocalizationProvider>
          </DarkModeProvider>
        </BackButtonProvider>
      </BackNavigationProvider>
    </AppProvider>
  );
};
