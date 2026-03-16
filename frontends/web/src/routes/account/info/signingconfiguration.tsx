// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, TAccount, TAmountWithConversions, TBitcoinSimple, TEthereumSimple, TSigningConfiguration, verifyXPub, getBalance } from '@/api/account';
import { getScriptName, isBitcoinBased, isEthereumBased } from '@/routes/account/utils';
import { alertUser } from '@/components/alert/Alert';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { A } from '@/components/anchor/anchor';
import { CopyableInput } from '@/components/copy/Copy';
import { Button } from '@/components/forms';
import { ExternalLink } from '@/components/icon';
import { Message } from '@/components/message/message';
import { QRCode } from '@/components/qrcode/qrcode';
import { truncateMiddle } from '@/utils/address';
import style from './info.module.css';

type TProps = {
  account: TAccount;
  info: TSigningConfiguration;
  code: AccountCode;
  signingConfigIndex: number;
  children: ReactNode;
};

export const SigningConfiguration = ({ account, info, code, signingConfigIndex, children }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [verifying, setVerifying] = useState(false);
  const [balance, setBalance] = useState<TAmountWithConversions>();

  useEffect(() => {
    if (isEthereumBased(account.coinCode)) {
      getBalance(code).then(response => {
        if (response.success) {
          setBalance(response.balance.available);
        }
      }).catch(console.error);
    }
  }, [code, account.coinCode]);

  const getSimpleInfo = (): TBitcoinSimple | TEthereumSimple => {
    if (info.bitcoinSimple !== undefined) {
      return info.bitcoinSimple;
    }
    return info.ethereumSimple;
  };

  const config = getSimpleInfo();
  const bitcoinBased = isBitcoinBased(account.coinCode);
  const contractAddress = account.contractAddress;
  const blockExplorerAddressPrefix = account.blockExplorerAddressPrefix;
  const contractAddressInfo = account.isToken && contractAddress && blockExplorerAddressPrefix
    ? {
      address: contractAddress,
      url: `${blockExplorerAddressPrefix}${contractAddress}`,
    }
    : null;
  return (
    <div className={style.address}>
      <div className={style.qrCode}>
        { bitcoinBased ? (
          <QRCode
            data={config.keyInfo.xpub}
            size={220} />
        ) : null }
      </div>
      <div className={style.details}>
        { account.isToken ? null : (
          <div key="accountname" className={style.entry}>
            {/* borrowing translation from accountSummary */}
            <strong>{t('accountSummary.name')}:</strong>
            <span>{account.name}</span>
          </div>
        )}
        <div key="keypath" className={style.entry}>
          <strong>Keypath:</strong>
          <code>{config.keyInfo.keypath}</code>
        </div>
        { ('scriptType' in config) ? (
          <div key="scriptName" className={style.entry}>
            <strong>{t('accountInfo.scriptType')}:</strong>
            <span>{getScriptName(config.scriptType)}</span>
          </div>
        ) : null}
        <div key="rootFingerprint" className={style.entry}>
          <strong>Root fingerprint:</strong>
          <code>{config.keyInfo.rootFingerprint}</code>
        </div>
        <div key="coinName" className={style.entry}>
          <strong>{account.isToken ? 'Token' : 'Coin'}:</strong>
          <span>{account.coinName} ({account.coinUnit})</span>
        </div>
        { balance ? (
          <div key="balance" className={style.entry}>
            <strong>{t('accountSummary.balance')}:</strong>
            <span>
              <AmountWithUnit amount={balance} />
            </span>
          </div>
        ) : null }
        { contractAddressInfo ? (
          <div key="contractAddress" className={style.entry}>
            <strong>{t('accountInfo.contractAddress')}:</strong>
            <div className={style.contractAddressLink}>
              <code>{truncateMiddle(contractAddressInfo.address)}</code>
              <A
                href={contractAddressInfo.url}
                title={contractAddressInfo.url}>
                <ExternalLink className={style.contractAddressLinkIcon} />
              </A>
            </div>
          </div>
        ) : null}
        { bitcoinBased ? (
          <div key="xpub" className={`${style.entry || ''} ${style.largeEntry || ''}`}>
            <strong className="m-right-half">
              {t('accountInfo.extendedPublicKey')}:
            </strong>
            <CopyableInput
              alignLeft
              flexibleHeight
              value={config.keyInfo.xpub} />
          </div>
        ) : null }
      </div>
      { contractAddressInfo ? (
        <Message className={style.warningMessage} type="warning">
          {t('accountInfo.contractAddressWarning')}
        </Message>
      ) : null}
      <div className={style.buttons}>
        { bitcoinBased ? (
          <Button className={style.verifyButton} primary disabled={verifying} onClick={async () => {
            setVerifying(true);
            try {
              const result = await verifyXPub(code, signingConfigIndex);
              if (!result.success) {
                alertUser(result.errorMessage);
              }
            } finally {
              setVerifying(false);
            }
          }
          }>
            {t('accountInfo.verify')}
          </Button>
        ) : (
          <Button className={style.verifyButton} primary onClick={() => navigate(`/account/${code}/receive`)}>
            {t('receive.verify')}
          </Button>
        ) }
        {children}
      </div>
    </div>
  );
};
