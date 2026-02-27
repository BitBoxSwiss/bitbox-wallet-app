// SPDX-License-Identifier: Apache-2.0

import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, TAccount, TBitcoinSimple, TEthereumSimple, TSigningConfiguration, verifyXPub } from '@/api/account';
import { getScriptName, isBitcoinBased } from '@/routes/account/utils';
import { alertUser } from '@/components/alert/Alert';
import { CopyableInput } from '@/components/copy/Copy';
import { Button } from '@/components/forms';
import { QRCode } from '@/components/qrcode/qrcode';
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

  const getSimpleInfo = (): TBitcoinSimple | TEthereumSimple => {
    if (info.bitcoinSimple !== undefined) {
      return info.bitcoinSimple;
    }
    return info.ethereumSimple;
  };

  const config = getSimpleInfo();
  const bitcoinBased = isBitcoinBased(account.coinCode);
  return (
    <div className={style.address}>
      <div className={style.qrCode}>
        { bitcoinBased ? (
          <QRCode
            data={config.keyInfo.xpub}
            size={220}
            tapToCopy={false} />
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
        { bitcoinBased ? (
          <div key="xpub" className={`${style.entry || ''} ${style.largeEntry || ''}`}>
            <strong className="m-right-half">
              {t('accountInfo.extendedPublicKey')}:
            </strong>
            <CopyableInput
              className={style.addressField}
              inputFieldClassName={style.addressFieldInput}
              buttonClassName={style.addressFieldButton}
              alignLeft
              flexibleHeight
              value={config.keyInfo.xpub} />
          </div>
        ) : null }
      </div>
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
