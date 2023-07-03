import { useTranslation } from 'react-i18next';
import { isBitcoinBased, isBitcoinOnly } from '../utils';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { CoinCode } from '../../../api/account';

type TProps = {
    coinCode: CoinCode
}

export default function SendGuide({ coinCode }: TProps) {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="guide.send.whyFee" entry={t('guide.send.whyFee')} />
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.priority" entry={t('guide.send.priority')} />
      )}
      { isBitcoinBased(coinCode) && (
        <Entry key="guide.send.fee" entry={t('guide.send.fee')} />
      )}
      { isBitcoinOnly(coinCode) && (
        <Entry key="guide.send.change" entry={t('guide.send.change')} />
      )}
      <Entry key="guide.send.revert" entry={t('guide.send.revert')} />
      <Entry key="guide.send.plugout" entry={t('guide.send.plugout')} />
    </Guide>
  );
}