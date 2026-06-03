// SPDX-License-Identifier: Apache-2.0

import { matchPath } from 'react-router-dom';

export const bitsurancePathPrefix = '/market/bitsurance';

const reservedBitsuranceRoutes = ['account', 'dashboard', 'widget'];

export const getRouteBitsuranceAccountCode = (pathname: string): string | undefined => {
  const bitsuranceIntroMatch = matchPath({ path: '/market/bitsurance/:code', end: true }, pathname);
  if (bitsuranceIntroMatch?.params.code && !reservedBitsuranceRoutes.includes(bitsuranceIntroMatch.params.code)) {
    return bitsuranceIntroMatch.params.code;
  }

  const bitsuranceStepMatch = matchPath({ path: '/market/bitsurance/:step/:code', end: true }, pathname);
  if (
    bitsuranceStepMatch?.params.step
    && reservedBitsuranceRoutes.includes(bitsuranceStepMatch.params.step)
    && bitsuranceStepMatch.params.code
  ) {
    return bitsuranceStepMatch.params.code;
  }
  return undefined;
};

export const getBitsurancePathWithAccountCode = (
  pathname: string,
  accountCode: string,
) => {
  const normalizedIntroMatch = matchPath({ path: '/market/bitsurance/:code', end: true }, pathname);
  if (normalizedIntroMatch?.params.code && !reservedBitsuranceRoutes.includes(normalizedIntroMatch.params.code)) {
    return pathname;
  }
  const normalizedStepMatch = matchPath({ path: '/market/bitsurance/:step/:code', end: true }, pathname);
  if (
    normalizedStepMatch?.params.step
    && reservedBitsuranceRoutes.includes(normalizedStepMatch.params.step)
    && normalizedStepMatch.params.code
  ) {
    return pathname;
  }
  if (matchPath({ path: '/market/bitsurance/account', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/account/${accountCode}`;
  }
  if (matchPath({ path: '/market/bitsurance/widget', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/widget/${accountCode}`;
  }
  if (matchPath({ path: '/market/bitsurance/dashboard', end: true }, pathname)) {
    return `${bitsurancePathPrefix}/dashboard/${accountCode}`;
  }
  return `${bitsurancePathPrefix}/${accountCode}`;
};
