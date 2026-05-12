// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AccountCode, CoinUnit, TAccount, TBalance } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { Button } from '@/components/forms';
import { Balances } from '@/routes/account/summary/accountssummary';
import { isBitcoinCoin, isEthereumBased } from '@/routes/account/utils';
import { ArrowFloorDownWhite, Coins, WalletConnectLight } from '@/components/icon';
import { SubTitle } from '@/components/title';
import styles from './buy-receive-cta.module.css';

type TBuyReceiveCTAProps = {
  balanceList?: TBalance[];
  code?: AccountCode;
  unit?: CoinUnit;
  account?: TAccount;
};

type TAddBuyReceiveOnEmpyBalancesProps = {
  balances?: Balances;
  accounts: TAccount[];
};

export const BuyReceiveCTA = ({
  balanceList,
  code,
  unit,
  account,
}: TBuyReceiveCTAProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isBitcoin = isBitcoinCoin(unit);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const onMarketCTA = () => navigate(code ? `/market/select/${code}` : '/market/select');
  const onWalletConnect = () => code && navigate(`/account/${code}/wallet-connect/dashboard`);
  const onReceiveCTA = () => {
    if (balanceList) {
      if (balanceList.length > 1) {
        navigate('/accounts/select-receive');
        return;
      }
      if (code) {
        navigate(`/account/${code}/receive`);
      }
    }
  };

  return (
    <div className={styles.container}>
      <SubTitle>
        {t('accountInfo.buyCTA.information.looksEmpty')}
      </SubTitle>
      <p>
        {t('accountInfo.buyCTA.information.start')}
      </p>
      <div className={styles.buttons}>
        {balanceList && (
          <Button className={styles.button} primary onClick={onReceiveCTA}>
            <ArrowFloorDownWhite width={18} height={18} />
            {/* "Receive Bitcoin", "Receive crypto" or "Receive LTC" (via placeholder "Receive {{coinCode}}") */}
            {t('generic.receive', {
              context: isBitcoin ? 'bitcoin' : (unit ? '' : 'crypto'),
              coinCode: unit
            })}
          </Button>
        )}
        {!isMobile && (
          <Button className={styles.button} primary onClick={onMarketCTA}>
            <Coins width={18} height={18} />
            {t('generic.buySell')}
          </Button>
        )}
        {account && isEthereumBased(account.coinCode) && !account.isToken && (
          <Button primary onClick={onWalletConnect} className={styles.walletConnect}>
            {isMobile ? (
              <WalletConnectLight width={28} height={28} />
            ) : (
              <>
                <WalletConnectLight width={28} height={28} /> <span>Wallet Connect</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export const AddBuyReceiveOnEmptyBalances = ({ balances, accounts }: TAddBuyReceiveOnEmpyBalancesProps) => {
  const onlyHasOneActiveAccount = accounts.length === 1;

  if (balances === undefined) {
    return null;
  }
  const balanceList = (
    accounts
      .map(account => balances[account.code])
      .filter(balance => !!balance)
  );

  // at least 1 active account has balance
  if (balanceList.some(entry => entry.hasAvailable)) {
    return null;
  }

  // all active accounts are bitcoin
  if (balanceList.map(entry => entry.available.unit).every(isBitcoinCoin)) {
    return (
      <BuyReceiveCTA
        balanceList={balanceList}
        code={onlyHasOneActiveAccount ? accounts[0]?.code : undefined}
        unit="BTC"
      />
    );
  }

  return (
    <BuyReceiveCTA
      balanceList={balanceList}
    />
  );
};
