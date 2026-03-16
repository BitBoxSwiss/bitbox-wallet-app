// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { DarkModeProvider } from './DarkmodeProvider';
import { AppProvider } from './AppProvider';
import { BackButtonProvider } from './BackButtonContext';
import { BackNavigationProvider } from './BackNavigationContext';
import { WCWeb3WalletProvider } from './WCWeb3WalletProvider';
import { RatesProvider } from './RatesProvider';
import { LocalizationProvider } from './localization-provider';

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
                <WCWeb3WalletProvider>
                  {children}
                </WCWeb3WalletProvider>
              </RatesProvider>
            </LocalizationProvider>
          </DarkModeProvider>
        </BackButtonProvider>
      </BackNavigationProvider>
    </AppProvider>
  );
};
