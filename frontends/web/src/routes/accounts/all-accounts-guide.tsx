// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

export const AllAccountsGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.account')}>
      <Entry key="whatAreAccounts" entry={t('guide.accounts.whatAreAccounts', { returnObjects: true })} />
    </Guide>
  );
};
