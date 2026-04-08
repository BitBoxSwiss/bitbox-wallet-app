// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, TAccount, TAccountBase } from '@/api/account';
import type { TSwapQuoteRoute } from '@/api/swap';
import {
  findAccount,
  getCoinCode,
  isBitcoinAccount,
  isNativeEthereumAccount,
} from '@/routes/account/utils';

type TSwapPair = {
  buyAccountCode?: AccountCode;
  sellAccountCode?: AccountCode;
};

export type TPairAmounts = {
  expectedOutput: string;
  sellAmount: string;
};

const isEligibleCounterpart = (account: TAccountBase, referenceAccount: TAccountBase) => (
  account.code !== referenceAccount.code && account.coinCode !== referenceAccount.coinCode
);

const getPreferredCounterpartCoinCodes = (account: TAccountBase) => {
  if (isNativeEthereumAccount(account)) {
    return ['btc'] as const;
  }
  if (isBitcoinAccount(account)) {
    return ['eth'] as const;
  }
  return ['btc', 'eth'] as const;
};

const findPreferredCounterpartAccount = (
  accounts: TAccountBase[],
  account: TAccountBase,
) => {
  const eligibleAccounts = accounts.filter(candidate => isEligibleCounterpart(candidate, account));
  if (!eligibleAccounts.length) {
    return;
  }

  // Prefer the common BTC/ETH paths first.
  for (const preferredCoinCode of getPreferredCounterpartCoinCodes(account)) {
    const matchingAccounts = eligibleAccounts.filter(
      candidate => getCoinCode(candidate.coinCode) === preferredCoinCode,
    );
    if (matchingAccounts.length) {
      return matchingAccounts[0];
    }
  }

  return eligibleAccounts[0];
};

export const getPreferredCounterpartAccountCode = (
  referenceAccounts: TAccountBase[],
  counterpartAccounts: TAccountBase[],
  accountCode?: AccountCode,
  currentCounterpartAccountCode?: AccountCode,
) => {
  const account = accountCode ? findAccount(referenceAccounts, accountCode) : undefined;
  if (!account) {
    return;
  }

  const currentCounterpartAccount = currentCounterpartAccountCode
    ? findAccount(counterpartAccounts, currentCounterpartAccountCode)
    : undefined;
  if (currentCounterpartAccount && isEligibleCounterpart(currentCounterpartAccount, account)) {
    return currentCounterpartAccount.code;
  }

  return findPreferredCounterpartAccount(counterpartAccounts, account)?.code;
};

const getPairForSellAccount = (
  sellAccounts: TAccountBase[],
  buyAccounts: TAccountBase[],
  sellAccount?: TAccountBase,
  currentBuyAccountCode?: AccountCode,
): TSwapPair => ({
  sellAccountCode: sellAccount?.code,
  buyAccountCode: sellAccount
    ? getPreferredCounterpartAccountCode(sellAccounts, buyAccounts, sellAccount.code, currentBuyAccountCode)
    : undefined,
});

const getFirstAvailablePair = (
  sellAccounts: TAccountBase[],
  buyAccounts: TAccountBase[],
): TSwapPair => {
  for (const account of sellAccounts) {
    const pair = getPairForSellAccount(sellAccounts, buyAccounts, account);
    if (pair.buyAccountCode) {
      return pair;
    }
  }
  return {};
};

export const getPairKey = (
  sellAccountCode?: AccountCode,
  buyAccountCode?: AccountCode,
) => (
  sellAccountCode && buyAccountCode ? `${sellAccountCode}:${buyAccountCode}` : undefined
);

export const getConnectedSwapAccounts = (accounts: TAccount[]) => (
  accounts.filter(account => account.keystore.connected)
);

export const getDisabledAccountCodes = (
  accounts: TAccountBase[],
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

export const getDefaultSwapPair = (
  sellAccounts: TAccountBase[],
  buyAccounts: TAccountBase[],
): TSwapPair => {
  // Start from native ETH when possible so the default pair lands on the most common ETH <-> BTC
  // path.
  const defaultEthPair = getPairForSellAccount(
    sellAccounts,
    buyAccounts,
    sellAccounts.find(isNativeEthereumAccount),
  );
  if (defaultEthPair.buyAccountCode) {
    return defaultEthPair;
  }

  return getFirstAvailablePair(sellAccounts, buyAccounts);
};

export const reconcileSwapPair = (
  sellAccounts: TAccountBase[],
  buyAccounts: TAccountBase[],
  currentPair: TSwapPair,
): TSwapPair => {
  const sellAccount = currentPair.sellAccountCode
    ? findAccount(sellAccounts, currentPair.sellAccountCode)
    : undefined;
  if (!sellAccount) {
    return getDefaultSwapPair(sellAccounts, buyAccounts);
  }

  return getPairForSellAccount(sellAccounts, buyAccounts, sellAccount, currentPair.buyAccountCode);
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

export const getSelectedRouteId = (
  routes: TSwapQuoteRoute[],
  currentRouteId?: string,
) => {
  if (routes.some(route => route.routeId === currentRouteId)) {
    return currentRouteId;
  }
  return routes[0]?.routeId;
};
