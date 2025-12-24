// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { isBitcoinBased, isBitcoinOnly } from '@/routes/account/utils';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { CoinCode } from '@/api/account';

type TProps = {
  coinCode: CoinCode;
};

export const SendGuide = ({ coinCode }: TProps) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.send')}>
      <Entry key="guide.send.whyFee" entry={{
        text: t('guide.send.whyFee.text'),
        title: t('guide.send.whyFee.title'),
      }} />
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.priority" entry={{
          text: t('guide.send.priority.text'),
          title: t('guide.send.priority.title'),
        }} />
      )}
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.fee" entry={{
          text: t('guide.send.fee.text'),
          title: t('guide.send.fee.title'),
        }} />
      )}
      { isBitcoinOnly(coinCode) && (
        <Entry key="guide.send.change" entry={{
          text: t('guide.send.change.text'),
          title: t('guide.send.change.title'),
        }} />
      )}
      <Entry key="guide.send.revert" entry={{
        text: t('guide.send.revert.text'),
        title: t('guide.send.revert.title'),
      }} />
      <Entry key="guide.send.plugout" entry={{
        text: t('guide.send.plugout.text'),
        title: t('guide.send.plugout.title'),
      }} />
    </Guide>
  );
};