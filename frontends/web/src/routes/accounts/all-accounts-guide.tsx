// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { getGuideEntry } from '@/utils/i18n-helpers';

export const AllAccountsGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.account')}>
      <Entry key="whatAreAccounts" entry={getGuideEntry(t, 'guide.accounts.whatAreAccounts')} />
    </Guide>
  );
};
