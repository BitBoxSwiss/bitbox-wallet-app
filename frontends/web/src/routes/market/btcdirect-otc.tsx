// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { BTCDirectOTCTerms } from '@/components/terms/btcdirect-otc-terms';
import { getBTCDirectOTCLink } from './components/infocontent';
import { TermsPage } from '@/components/terms/terms-page';
import { open } from '@/api/system';

export const BTCDirectOTC = () => {
  const { t } = useTranslation();

  const openBTCDirect = () => {
    open(getBTCDirectOTCLink());
    history.back();
  };

  const title = t('buy.exchange.infoContent.btcdirect.disclaimer.title');

  return (
    <TermsPage title={title}>
      <BTCDirectOTCTerms onContinue={() => openBTCDirect()} />
    </TermsPage>
  );
};
