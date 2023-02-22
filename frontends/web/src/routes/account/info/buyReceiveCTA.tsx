/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTranslation } from 'react-i18next';
import { route } from '../../../utils/route';
import { Coin, IBalance } from '../../../api/account';
import { Button } from '../../../components/forms';
import { Balances } from '../summary/accountssummary';
import styles from './buyReceiveCTA.module.css';

type TBuyReceiveCTAProps = {
  balanceList?: [string, IBalance][];
  code?: string;
  unit?: string;
};

type CoinWithSAT = Coin | 'sat' | 'tsat';

export const BuyReceiveCTA = ({ code, unit, balanceList }: TBuyReceiveCTAProps) => {
  const { t } = useTranslation();
  const onBuyCTA = () => route(code ? `/buy/exchange/${code}` : '/buy/info');
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        route('accounts/select-receive');
        return;
      }
      route(`/account/${balanceList[0][0]}/receive`);
    }
  };

  return (
    <div className={`${styles.main}`}>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.looksEmpty')}</h3>
      <h3 className="subTitle">{t('accountInfo.buyCTA.information.start')}</h3>
      <div className={styles.container}>
        {balanceList && <Button primary onClick={onReceiveCTA}>{unit ? t('receive.title', { accountName: unit }) : t('receive.title', { accountName: t('buy.info.crypto') })}</Button>}
        <Button primary onClick={onBuyCTA}>{unit ? t('accountInfo.buyCTA.buy', { unit }) : t('accountInfo.buyCTA.buyCrypto')}</Button>
      </div>
    </div>);
};

const isBitcoinCoin = (coin: CoinWithSAT) => (coin === 'BTC') || (coin === 'TBTC') || (coin === 'sat') || (coin === 'tsat');

export const AddBuyReceiveOnEmptyBalances = ({ balances }: {balances?: Balances}) => {
  if (balances === undefined) {
    return null;
  }
  const balanceList = Object.entries(balances);
  if (balanceList.some(entry => entry[1].hasAvailable)) {
    return null;
  }
  if (balanceList.map(entry => entry[1].available.unit).every(isBitcoinCoin)) {
    return <BuyReceiveCTA code={balanceList[0][0]} unit={'BTC'} balanceList={balanceList} />;
  }
  return <BuyReceiveCTA balanceList={balanceList} />;
};
