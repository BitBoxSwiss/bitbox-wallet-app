/**
 * Copyright 2022 Shift Crypto AG
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
import { Link } from 'react-router-dom';
import { WalletConnectLight } from '../../components/icon';
import { useMediaQuery } from '../../hooks/mediaquery';
import style from './account.module.css';
import { IAccount } from '../../api/account';
import { isEthereumBased } from './utils';

type TProps = {
    canSend?: boolean;
    code: string;
    exchangeBuySupported?: boolean;
    account: IAccount;
}

export const ActionButtons = ({ canSend, code, exchangeBuySupported, account }: TProps) => {
  const { t } = useTranslation();
  const walletConnectEnabled = isEthereumBased(account.coinCode) && !account.isToken;
  const isLargeTablet = useMediaQuery('(max-width: 830px)');
  return (
    <div className={`${style.actionsContainer} ${walletConnectEnabled ? style.withWalletConnect : ''}`}>
      {canSend ? (
        <Link key="sendLink" to={`/account/${code}/send`} className={style.send}>
          <span>{t('button.send')}</span>
        </Link>
      ) : (
        <span key="sendDisabled" className={`${style.send} ${style.disabled}`}>
          {t('button.send')}
        </span>
      )}
      <Link key="receive" to={`/account/${code}/receive`} className={style.receive}>
        <span>{t('button.receive')}</span>
      </Link>
      { exchangeBuySupported && (
        <Link key="buy" to={`/buy/info/${code}`} className={style.buy}>
          <span>{t('button.buy')}</span>
        </Link>
      )}
      {walletConnectEnabled && <Link key="wallet-connect" to={`/account/${code}/wallet-connect/dashboard`} className={style.walletConnect}>
        <WalletConnectLight width={18} /> {!isLargeTablet && <span>Wallet Connect</span>}
      </Link>}
    </div>
  );
};
