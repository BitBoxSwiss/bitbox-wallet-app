/**
 * Copyright 2022-2024 Shift Crypto AG
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

import { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletConnectLight } from '@/components/icon';
import { useMediaQuery } from '@/hooks/mediaquery';
import { connectKeystore, AccountCode, IAccount, CoinCode } from '@/api/account';
import { isEthereumBased } from './utils';
import style from './account.module.css';

type TProps = {
  canSend?: boolean;
  code: AccountCode;
  coinCode: CoinCode;
  exchangeSupported?: boolean;
  account: IAccount;
  accountDataLoaded: boolean;
}

export const ActionButtons = ({ canSend, code, coinCode, exchangeSupported, account, accountDataLoaded }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const walletConnectEnabled = isEthereumBased(account.coinCode) && !account.isToken;
  const isLargeTablet = useMediaQuery('(max-width: 830px)');

  // When clicking 'Send', for Ethereum based accounts we first prompt to connect the keystore
  // before proceeding. The reason is that in ETH, we need to know what keystore (which BitBox02
  // version) is connected to decide which ETH transaction proposals to construct (legacy vs EIP1559).
  const sendLink = `/account/${code}/send`;
  const maybeRouteSend = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const connectResult = await connectKeystore(code);
    if (connectResult.success) {
      // Proceed to the send screen if the keystore was connected.
      navigate(sendLink);
    }
  };

  return (
    <div className={`${style.actionsContainer} ${walletConnectEnabled ? style.withWalletConnect : ''}`}>
      {canSend && accountDataLoaded ? (
        <Link key="sendLink" to={sendLink} className={style.send} onClick={isEthereumBased(coinCode) ? maybeRouteSend : undefined}>
          <span>{t('button.send')}</span>
        </Link>
      ) : (
        <span key="sendDisabled" className={`${style.send} ${style.disabled}`}>
          {t('button.send')}
        </span>
      )}

      {accountDataLoaded ? (
        <Link key="receive" to={`/account/${code}/receive`} className={style.receive}>
          <span>{t('button.receive')}</span>
        </Link>
      ) : (
        <span key="receiveDisabled" className={`${style.receive} ${style.disabled}`}>
          {t('button.receive')}
        </span>
      )}

      {exchangeSupported && (
        accountDataLoaded ? (
          <Link key="exchange" to={`/exchange/info/${code}`} className={style.exchange}>
            <span>{t('generic.buySell')}</span>
          </Link>
        ) : (
          <span key="buySellDisabled" className={`${style.exchange} ${style.disabled}`}>
            {t('generic.buySell')}
          </span>
        )
      )}

      {walletConnectEnabled && (
        accountDataLoaded ? (
          <Link key="wallet-connect" to={`/account/${code}/wallet-connect/dashboard`} className={style.walletConnect}>
            <WalletConnectLight width={24}/> {!isLargeTablet && <span>Wallet Connect</span>}
          </Link>
        ) : (
          <span key="wcDisabled" className={`${style.walletConnect} ${style.disabled}`}>
            <WalletConnectLight width={24}/> {!isLargeTablet && <span>Wallet Connect</span>}
          </span>
        )
      )}
    </div>
  );
};
