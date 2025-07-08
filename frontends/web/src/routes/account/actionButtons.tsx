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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletConnectLight } from '@/components/icon';
import { useMediaQuery } from '@/hooks/mediaquery';
import { connectKeystore, AccountCode, IAccount, CoinCode } from '@/api/account';
import { isEthereumBased } from './utils';
import { ButtonLink } from '@/components/forms';
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
  const isMobile = useMediaQuery('(max-width: 768px)');

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

  const canClickSend = canSend && accountDataLoaded;

  return (
    <div className={`${style.actionsContainer} ${walletConnectEnabled ? style.withWalletConnect : ''}`}>
      <ButtonLink
        className={style.button}
        disabled={!canClickSend}
        primary
        to={sendLink}
        onClick={isEthereumBased(coinCode) ? maybeRouteSend : undefined}
      >
        <span>{t('button.send')}</span>
      </ButtonLink>

      <ButtonLink
        className={style.button}
        disabled={!accountDataLoaded}
        primary
        to={`/account/${code}/receive`}
      >
        <span>{t('button.receive')}</span>
      </ButtonLink>

      {(exchangeSupported && !isMobile) && (
        <ButtonLink
          className={style.button}
          disabled={!accountDataLoaded}
          primary
          to={`/exchange/info/${code}`}
        >
          <span>{t('generic.buySell')}</span>
        </ButtonLink>
      )}

      {walletConnectEnabled && (
        <ButtonLink
          className={style.button}
          primary
          disabled={!accountDataLoaded}
          to={`/account/${code}/wallet-connect/dashboard`}
        >
          <WalletConnectLight width={24}/> {!isLargeTablet && <span>Wallet Connect</span>}
        </ButtonLink>
      )}
    </div>
  );
};
