// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { PocketOTCTerms } from '@/components/terms/pocket-otc-terms';
import { TermsPage } from '@/components/terms/terms-page';
import { getPocketOTCLink } from './components/infocontent';

export const PocketOTC = () => {
  const { t } = useTranslation();

  const openPocketOTC = () => {
    open(getPocketOTCLink());
    history.back();
  };

  const title = t('buy.exchange.infoContent.btcdirect.disclaimer.title');

  return (
    <TermsPage title={title}>
      <PocketOTCTerms onContinue={() => openPocketOTC()} />
    </TermsPage>
  );
};
