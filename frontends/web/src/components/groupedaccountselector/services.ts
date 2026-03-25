// SPDX-License-Identifier: Apache-2.0

import type { TAccountsByKeystore } from '@/api/account';
import { isAmbiguousName } from '@/routes/account/utils';
import type { TGroupedOption, TOption } from './groupedaccountselector';

export const createGroupedOptions = (accountsByKeystore: TAccountsByKeystore[]) => {
  return accountsByKeystore.map(({ keystore, accounts }) => ({
    label: `${keystore.name} ${isAmbiguousName(keystore.name, accountsByKeystore) ? `(${keystore.rootFingerprint})` : ''}`,
    connected: keystore.connected,
    options: accounts.map((account) => ({ label: account.name, value: account.code, coinCode: account.coinCode, disabled: false })) as TOption[]
  }));
};

const appendBalance = async (option: TOption) => {
  const { getBalance } = await import('@/api/account');
  const balance = await getBalance(option.value);
  if (!balance.success) {
    return { ... option };
  }
  return { ...option, balance: balance.balance.available };
};

export const getBalancesForGroupedAccountSelector = async (originalGroupedOptions: TGroupedOption[]) => {

  const groupedOptions = originalGroupedOptions.map(group => ({
    ...group,
    options: [...group.options]
  }));
  for (const group of groupedOptions) {
    const promises = group.options.map(appendBalance);
    group.options = await Promise.all(promises);
  }

  return groupedOptions;
};
