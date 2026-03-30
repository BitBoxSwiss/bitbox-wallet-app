// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, TAccount } from '@/api/account';
import type { TSwapQuoteRoute } from '@/api/swap';
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

const findOptionalAccount = (
  accounts: TAccount[],
  accountCode?: AccountCode,
) => (
  accountCode ? findAccount(accounts, accountCode) : undefined
);

const isEligibleCounterpart = (account: TAccount, referenceAccount: TAccount) => (
  account.code !== referenceAccount.code && account.coinCode !== referenceAccount.coinCode
);

const getPreferredCounterpartCoinCodes = (account: TAccount) => {
  if (isNativeEthereumAccount(account)) {
    return ['btc'] as const;
  }
  if (isBitcoinAccount(account)) {
    return ['eth'] as const;
  }
  return ['btc', 'eth'] as const;
};

const findPreferredCounterpartAccount = (
  accounts: TAccount[],
  account: TAccount,
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

const getPreferredCounterpartAccountCode = (
  accounts: TAccount[],
  accountCode?: AccountCode,
  currentCounterpartAccountCode?: AccountCode,
) => {
  const account = findOptionalAccount(accounts, accountCode);
  if (!account) {
    return;
  }

  const currentCounterpartAccount = findOptionalAccount(accounts, currentCounterpartAccountCode);
  if (currentCounterpartAccount && isEligibleCounterpart(currentCounterpartAccount, account)) {
    return currentCounterpartAccount.code;
  }

  return findPreferredCounterpartAccount(accounts, account)?.code;
};

const getPairForSellAccount = (
  accounts: TAccount[],
  sellAccount?: TAccount,
  currentBuyAccountCode?: AccountCode,
): TSwapPair => ({
  sellAccountCode: sellAccount?.code,
  buyAccountCode: sellAccount
    ? getPreferredCounterpartAccountCode(accounts, sellAccount.code, currentBuyAccountCode)
    : undefined,
});

const getFirstAvailablePair = (accounts: TAccount[]): TSwapPair => {
  for (const account of accounts) {
    const pair = getPairForSellAccount(accounts, account);
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
  accounts: TAccount[],
  oppositeAccountCode?: AccountCode,
) => {
  const oppositeAccount = findOptionalAccount(accounts, oppositeAccountCode);
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
) => getPreferredCounterpartAccountCode(accounts, sellAccountCode, currentBuyAccountCode);

export const getPreferredSellAccountCode = (
  accounts: TAccount[],
  buyAccountCode?: AccountCode,
  currentSellAccountCode?: AccountCode,
) => getPreferredCounterpartAccountCode(accounts, buyAccountCode, currentSellAccountCode);

export const getDefaultSwapPair = (
  accounts: TAccount[],
  routeSellAccountCode?: AccountCode,
): TSwapPair => {
  const routePair = getPairForSellAccount(accounts, findOptionalAccount(accounts, routeSellAccountCode));
  if (routePair.sellAccountCode) {
    return routePair;
  }

  // Without a route override, start from native ETH when possible so the default pair lands on
  // the most common ETH <-> BTC path.
  const defaultEthPair = getPairForSellAccount(accounts, accounts.find(isNativeEthereumAccount));
  if (defaultEthPair.buyAccountCode) {
    return defaultEthPair;
  }

  return getFirstAvailablePair(accounts);
};

export const reconcileSwapPair = (
  accounts: TAccount[],
  currentPair: TSwapPair,
  routeSellAccountCode?: AccountCode,
): TSwapPair => {
  const sellAccount = findOptionalAccount(accounts, currentPair.sellAccountCode);
  if (!sellAccount) {
    return getDefaultSwapPair(accounts, routeSellAccountCode);
  }

  return getPairForSellAccount(accounts, sellAccount, currentPair.buyAccountCode);
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
