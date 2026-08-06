// SPDX-License-Identifier: Apache-2.0

import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowFloorDownWhite, ArrowFloorUpWhite, Coins, WalletConnectLight } from '@/components/icon';
import { useMediaQuery } from '@/hooks/mediaquery';
import { AccountCode, TAccount, CoinCode } from '@/api/account';
import { isEthereumBased } from './utils';
import { AccountActionButtonLink } from './components/account-action-button-link';
import { AccountActionButtons } from './components/account-action-buttons';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { useFeatureConnect } from '@/hooks/keystore';
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
  const {
    connect,
    dismissFirmwareUpgrade,
    firmwareUpgradeRequired,
  } = useFeatureConnect();
  const walletConnectEnabled = isEthereumBased(account.coinCode) && !account.isToken;
  const isLargeTablet = useMediaQuery('(max-width: 830px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  // When clicking 'Send', first prompt to connect the keystore and check that it supports signing.
  // For Ethereum based accounts, we also need to know which keystore (which BitBox02 version) is
  // connected to decide which ETH transaction proposals to construct (legacy vs EIP1559).
  const sendLink = `/account/${code}/send`;
  const routeSend = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const requiredFeature = isEthereumBased(coinCode)
      ? 'ethTransactionSigning'
      : 'btcTransactionSigning';
    if (await connect(account.keystore.rootFingerprint, requiredFeature)) {
      // Proceed to the send screen if the keystore was connected.
      navigate(sendLink);
    }
  };

  const canClickSend = canSend && accountDataLoaded;

  return (
    <AccountActionButtons withWalletConnect={walletConnectEnabled}>
      <AccountActionButtonLink
        disabled={!canClickSend}
        to={sendLink}
        onClick={routeSend}
      >
        <ArrowFloorUpWhite width={16} height={16} />
        <span>{t('generic.send')}</span>
      </AccountActionButtonLink>

      <AccountActionButtonLink
        disabled={!accountDataLoaded}
        to={`/account/${code}/receive`}
      >
        <ArrowFloorDownWhite width={16} height={16} />
        <span data-testid="receive-button">{t('generic.receiveWithoutCoinCode')}</span>
      </AccountActionButtonLink>

      {(exchangeSupported && !isMobile) && (
        <AccountActionButtonLink
          disabled={!accountDataLoaded}
          to={`/market/select/${code}`}
        >
          <Coins width={17} height={17} />
          <span>{t('generic.buySell')}</span>
        </AccountActionButtonLink>
      )}

      {walletConnectEnabled && (
        <AccountActionButtonLink
          disabled={!accountDataLoaded}
          to={`/account/${code}/wallet-connect/dashboard`}
        >
          <WalletConnectLight className={style.iconWalletConnect}/>
          {' '}
          {!isLargeTablet && (
            <span>Wallet Connect</span>
          )}
        </AccountActionButtonLink>
      )}
      {firmwareUpgradeRequired && (
        <FirmwareUpgradeRequiredDialog
          open
          onClose={dismissFirmwareUpgrade}
        />
      )}
    </AccountActionButtons>
  );
};
