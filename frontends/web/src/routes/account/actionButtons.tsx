// SPDX-License-Identifier: Apache-2.0

import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowFloorDownWhite, ArrowFloorUpWhite, Coins, WalletConnectLight } from '@/components/icon';
import { useMediaQuery } from '@/hooks/mediaquery';
import { AccountCode, TAccount, CoinCode } from '@/api/account';
import { isEthereumBased } from './utils';
import { ButtonLink } from '@/components/forms';
import { connectKeystore } from '@/api/keystores';
import style from './account.module.css';

type TProps = {
  canSend?: boolean;
  code: AccountCode;
  coinCode: CoinCode;
  exchangeSupported?: boolean;
  account: TAccount;
  accountDataLoaded: boolean;
};

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
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (connectResult.success) {
      // Proceed to the send screen if the keystore was connected.
      navigate(sendLink);
    }
  };

  const canClickSend = canSend && accountDataLoaded;

  return (
    <div className={`
      ${style.actionsContainer || ''}
      ${walletConnectEnabled && style.withWalletConnect || ''}
    `}>
      <ButtonLink
        className={style.button}
        disabled={!canClickSend}
        primary
        to={sendLink}
        onClick={isEthereumBased(coinCode) ? maybeRouteSend : undefined}
      >
        <ArrowFloorUpWhite width={16} height={16} />
        <span>{t('generic.send')}</span>
      </ButtonLink>

      <ButtonLink
        className={style.button}
        disabled={!accountDataLoaded}
        primary
        to={`/account/${code}/receive`}
      >
        <ArrowFloorDownWhite width={16} height={16} />
        <span data-testid="receive-button">{t('generic.receiveWithoutCoinCode')}</span>
      </ButtonLink>

      {(exchangeSupported && !isMobile) && (
        <ButtonLink
          className={style.button}
          disabled={!accountDataLoaded}
          primary
          to={`/market/select/${code}`}
        >
          <Coins width={17} height={17} />
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
          <WalletConnectLight className={style.iconWalletConnect}/>
          {' '}
          {!isLargeTablet && (
            <span>Wallet Connect</span>
          )}
        </ButtonLink>
      )}
    </div>
  );
};
