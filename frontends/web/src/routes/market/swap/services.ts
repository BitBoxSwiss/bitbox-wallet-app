// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, TAccount } from '@/api/account';
import { findAccount, getCoinCode } from '@/routes/account/utils';

type TSwapPair = {
  buyAccountCode?: AccountCode;
  sellAccountCode?: AccountCode;
};

export type TPairAmounts = {
  expectedOutput: string;
  sellAmount: string;
};

const isNativeEthereumAccount = (account: TAccount) => (
  getCoinCode(account.coinCode) === 'eth' && !account.isToken
);

const isBitcoinAccount = (account: TAccount) => getCoinCode(account.coinCode) === 'btc';

const sharesKeystore = (account: TAccount, referenceAccount: TAccount) => (
  account.keystore.rootFingerprint === referenceAccount.keystore.rootFingerprint
);

const getEligibleCounterpartAccounts = (accounts: TAccount[], account: TAccount) => (
  accounts.filter(candidate => candidate.code !== account.code && candidate.coinCode !== account.coinCode)
);

const findPreferredAccount = (
  accounts: TAccount[],
  predicate: (account: TAccount) => boolean,
  referenceAccount?: TAccount,
) => {
  const matchingAccounts = accounts.filter(predicate);
  if (!matchingAccounts.length) {
    return;
  }
  if (referenceAccount) {
    return matchingAccounts.find(account => sharesKeystore(account, referenceAccount)) || matchingAccounts[0];
  }
  return matchingAccounts[0];
};

const getCounterpartPreferences = (account: TAccount) => {
  if (isNativeEthereumAccount(account)) {
    return [isBitcoinAccount];
  }
  if (isBitcoinAccount(account)) {
    return [isNativeEthereumAccount];
  }
  return [isBitcoinAccount, isNativeEthereumAccount];
};

const getPreferredCounterpartAccount = (
  accounts: TAccount[],
  account: TAccount,
) => {
  const eligibleAccounts = getEligibleCounterpartAccounts(accounts, account);
  for (const preference of getCounterpartPreferences(account)) {
    const preferredAccount = findPreferredAccount(eligibleAccounts, preference, account);
    if (preferredAccount) {
      return preferredAccount;
    }
  }
  return findPreferredAccount(eligibleAccounts, () => true, account);
};

export const getPairKey = (
  sellAccountCode?: AccountCode,
  buyAccountCode?: AccountCode,
) => (
  sellAccountCode && buyAccountCode ? `${sellAccountCode}:${buyAccountCode}` : undefined
);

export const getDisabledAccountCodes = (
  accounts: TAccount[],
  oppositeAccountCode?: AccountCode,
) => {
  const oppositeAccount = oppositeAccountCode ? findAccount(accounts, oppositeAccountCode) : undefined;
  if (!oppositeAccount) {
    return [];
  }
  return accounts
    .filter(account => account.coinCode === oppositeAccount.coinCode)
    .map(account => account.code);
};

export const getPreferredBuyAccountCode = (
  accounts: TAccount[],
  sellAccountCode?: AccountCode,
  currentBuyAccountCode?: AccountCode,
) => {
  const sellAccount = sellAccountCode ? findAccount(accounts, sellAccountCode) : undefined;
  if (!sellAccount) {
    return;
  }

  const currentBuyAccount = currentBuyAccountCode ? findAccount(accounts, currentBuyAccountCode) : undefined;
  if (currentBuyAccount && currentBuyAccount.coinCode !== sellAccount.coinCode) {
    return currentBuyAccount.code;
  }

  return getPreferredCounterpartAccount(accounts, sellAccount)?.code;
};

export const getPreferredSellAccountCode = (
  accounts: TAccount[],
  buyAccountCode?: AccountCode,
  currentSellAccountCode?: AccountCode,
) => {
  const buyAccount = buyAccountCode ? findAccount(accounts, buyAccountCode) : undefined;
  if (!buyAccount) {
    return;
  }

  const currentSellAccount = currentSellAccountCode ? findAccount(accounts, currentSellAccountCode) : undefined;
  if (currentSellAccount && currentSellAccount.coinCode !== buyAccount.coinCode) {
    return currentSellAccount.code;
  }

  return getPreferredCounterpartAccount(accounts, buyAccount)?.code;
};

export const getDefaultSwapPair = (
  accounts: TAccount[],
  routeSellAccountCode?: AccountCode,
): TSwapPair => {
  const routeSellAccount = routeSellAccountCode ? findAccount(accounts, routeSellAccountCode) : undefined;
  if (routeSellAccount) {
    return {
      sellAccountCode: routeSellAccount.code,
      buyAccountCode: getPreferredBuyAccountCode(accounts, routeSellAccount.code),
    };
  }

  const defaultEthAccount = findPreferredAccount(accounts, isNativeEthereumAccount);
  if (defaultEthAccount) {
    const buyAccountCode = getPreferredBuyAccountCode(accounts, defaultEthAccount.code);
    if (buyAccountCode) {
      return {
        sellAccountCode: defaultEthAccount.code,
        buyAccountCode,
      };
    }
  }

  const defaultSellAccount = accounts.find(account => getPreferredBuyAccountCode(accounts, account.code));
  return {
    sellAccountCode: defaultSellAccount?.code,
    buyAccountCode: defaultSellAccount ? getPreferredBuyAccountCode(accounts, defaultSellAccount.code) : undefined,
  };
};

export const reconcileSwapPair = (
  accounts: TAccount[],
  currentPair: TSwapPair,
  routeSellAccountCode?: AccountCode,
): TSwapPair => {
  const sellAccount = currentPair.sellAccountCode ? findAccount(accounts, currentPair.sellAccountCode) : undefined;
  if (!sellAccount) {
    return getDefaultSwapPair(accounts, routeSellAccountCode);
  }

  return {
    sellAccountCode: sellAccount.code,
    buyAccountCode: getPreferredBuyAccountCode(accounts, sellAccount.code, currentPair.buyAccountCode),
  };
};

export const getFlippedAmounts = (
  pairAmountsByKey: Record<string, TPairAmounts>,
  sellAccountCode: AccountCode,
  buyAccountCode: AccountCode,
  sellAmount: string,
  expectedOutput: string,
): TPairAmounts => {
  const reversePairAmounts = pairAmountsByKey[getPairKey(buyAccountCode, sellAccountCode) || ''];
  return {
    sellAmount: reversePairAmounts?.sellAmount || expectedOutput,
    expectedOutput: reversePairAmounts?.expectedOutput || sellAmount,
  };
};
