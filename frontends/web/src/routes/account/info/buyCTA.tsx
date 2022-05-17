import { FunctionComponent } from 'react';
import { route } from '../../../utils/route';
import { Coin } from '../../../api/account';
import { Button } from '../../../components/forms';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Balances } from '../summary/accountssummary';
import styles from './buyCTA.module.css';

interface BuyCTAProps {
    code?: string;
    unit?: string;
}

type Props = BuyCTAProps & TranslateProps;

const BuyCTAComponent: FunctionComponent<Props> = ({ code, unit, t }) => {
  const onCTA = () => route(code ? `/buy/info/${code}` : '/buy/info');
  return (
    <div className={`${styles.main} columns-container`}>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.looksEmpty')}</h3>
      <h3>{t('accountInfo.buyCTA.information.start')}</h3>
      <div>
        <Button primary onClick={onCTA}>{unit ? t('accountInfo.buyCTA.buy', { unit }) : t('accountInfo.buyCTA.buyCrypto')}</Button>
      </div>
    </div>);
};

export const BuyCTA = translate()(BuyCTAComponent);

const isBitcoinCoin = (coin: Coin) => (coin === 'BTC') || (coin === 'TBTC');

export const AddBuyOnEmptyBalances: FunctionComponent<{balances?: Balances}> = ({ balances }) => {
  if (balances === undefined) {
    return null;
  }
  const balanceList = Object.entries(balances);
  if (balanceList.some(entry => entry[1].available.amount !== '0')) {
    return null;
  }
  if (balanceList.map(entry => entry[1].available.unit).every(isBitcoinCoin)) {
    return <BuyCTA code={balanceList[0][0]} unit={'BTC'} />;
  }
  return <BuyCTA />;
};
