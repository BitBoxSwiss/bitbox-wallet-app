// SPDX-License-Identifier: Apache-2.0

import { TokenListItem } from '@/components/token-list-item/token-list-item';
import { CoinCode, TAccount, TAmountWithConversions } from '@/api/account';
import { useNavigate } from 'react-router-dom';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Balances } from './accountssummary';
import style from './accountssummary.module.css';

type Props = {
  account: TAccount;
  coinCode: CoinCode;
  isFirst: boolean;
  balances?: Balances;
};

const coinLineColors: Partial<Record<CoinCode, string>> = {
  'btc': '#F7931A80',
  'tbtc': '#F7931A80',
  'rbtc': '#F7931A80',
  'ltc': '#345D9D80',
  'tltc': '#345D9D80',
  'eth': '#627EEA80',
  'sepeth': '#627EEA80',
  'eth-erc20-usdt': '#26A17B80',
  'eth-erc20-usdc': '#2775C980',
  'eth-erc20-dai0x6b17': '#F4B73180',
  'eth-erc20-link': '#2A5ADA80',
  'eth-erc20-mkr': '#1ABC9C80',
  'eth-erc20-zrx': '#80808080',
  'eth-erc20-wbtc': '#FFD22080',
  'eth-erc20-paxg': '#EDE70A80',
  'eth-erc20-bat': '#FF042080'
};

const getCoinLineColor = (coinCode: CoinCode): string => {
  return coinLineColors[coinCode] ?? '#00000080';
};

export const AssetBalanceWithLine = ({ account, coinCode, isFirst, balances }: Props) => {
  const lineColor = getCoinLineColor(coinCode);
  const navigate = useNavigate();
  const balance = balances?.[account.code];

  return (
    <div className={`${style.tokenItem || ''} ${isFirst ? style.tokenItemFirst || '' : ''}`} key={account.code}>
      <TokenListItem
        className={style.tokenListItemGrid}
        coinCode={account.coinCode}
        name={account.name}
        lineColor={lineColor}
        onClick={() => navigate(`/account/${account.code}`)}
      >
        <TokenAmounts balance={balance?.available} />
      </TokenListItem>
    </div>
  );
};

const TokenAmounts = ({ balance }: { balance?: TAmountWithConversions }) => {
  return (
    <div className={`${style.assetBalanceAmounts || ''}`}>
      {!balance ? (
        <>
          <Skeleton minWidth="60px" />
          <Skeleton minWidth="40px" />
        </>
      ) : (
        <>
          <AmountWithUnit amount={balance} />
          <AmountWithUnit amount={balance} convertToFiat />
        </>
      )}
    </div>
  );
};