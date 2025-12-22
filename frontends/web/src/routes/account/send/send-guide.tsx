// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { isBitcoinBased, isBitcoinOnly } from '@/routes/account/utils';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { CoinCode } from '@/api/account';
import { getGuideEntry } from '@/utils/i18n-helpers';

type TProps = {
  coinCode: CoinCode;
};

export const SendGuide = ({ coinCode }: TProps) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.send')}>
      <Entry key="guide.send.whyFee" entry={getGuideEntry(t, 'guide.send.whyFee')} />
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.priority" entry={getGuideEntry(t, 'guide.send.priority')} />
      )}
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.fee" entry={getGuideEntry(t, 'guide.send.fee')} />
      )}
      { isBitcoinOnly(coinCode) && (
        <Entry key="guide.send.change" entry={getGuideEntry(t, 'guide.send.change')} />
      )}
      <Entry key="guide.send.revert" entry={getGuideEntry(t, 'guide.send.revert')} />
      <Entry key="guide.send.plugout" entry={getGuideEntry(t, 'guide.send.plugout')} />
    </Guide>
  );
};