import { useTranslation } from 'react-i18next';
import { isBitcoinBased, isBitcoinOnly } from '@/routes/account/utils';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { CoinCode } from '@/api/account';

type TProps = {
  coinCode: CoinCode
};

export const SendGuide = ({ coinCode }: TProps) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.send')}>
      <Entry key="guide.send.whyFee" entry={t('guide.send.whyFee', { returnObjects: true })} />
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.priority" entry={t('guide.send.priority', { returnObjects: true })} />
      )}
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.fee" entry={t('guide.send.fee', { returnObjects: true })} />
      )}
      { isBitcoinOnly(coinCode) && (
        <Entry key="guide.send.change" entry={t('guide.send.change', { returnObjects: true })} />
      )}
      <Entry key="guide.send.revert" entry={t('guide.send.revert', { returnObjects: true })} />
      <Entry key="guide.send.plugout" entry={t('guide.send.plugout', { returnObjects: true })} />
    </Guide>
  );
};