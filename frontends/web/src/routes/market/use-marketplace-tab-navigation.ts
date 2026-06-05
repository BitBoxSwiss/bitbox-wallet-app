// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TMarketplaceTab } from './components/markettab';

export const useMarketplaceTabNavigation = (
  accounts: TAccount[],
  selectedAccountCode: string,
) => {
  const navigate = useNavigate();

  return (tab: TMarketplaceTab) => {
    if (tab === 'insure') {
      const bitsurancePath = accounts.some(({ bitsuranceStatus }) => bitsuranceStatus)
        ? `/market/bitsurance/dashboard${selectedAccountCode ? `/${selectedAccountCode}` : ''}`
        : `/market/bitsurance${selectedAccountCode ? `/${selectedAccountCode}` : ''}`;
      navigate(bitsurancePath);
      return;
    }
    const marketSelectPath = selectedAccountCode ? `/market/select/${selectedAccountCode}` : '/market/select';
    navigate(`${marketSelectPath}?tab=${tab}`);
  };
};
