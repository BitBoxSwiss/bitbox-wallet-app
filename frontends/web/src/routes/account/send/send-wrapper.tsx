// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { AccountCode, TAccount } from '@/api/account';
import { RatesContext } from '@/contexts/RatesContext';
import { findAccount } from '@/routes/account/utils';
import { Send } from './send';

type TSendProps = {
  activeAccounts: TAccount[];
  code: AccountCode;
};

export const SendWrapper = ({ activeAccounts, code }: TSendProps) => {
  const { defaultCurrency } = useContext(RatesContext);
  const account = findAccount(activeAccounts, code);

  return (
    account ? (
      <Send
        account={account}
        activeAccounts={activeAccounts}
        activeCurrency={defaultCurrency}
      />
    ) : (null)
  );
};
