/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AccountCode,
  IAccount,
  TBitcoinSimple,
  TEthereumSimple,
  TSigningConfiguration,
  verifyXPub,
} from '@/api/account';
import { getScriptName, isBitcoinBased } from '@/routes/account/utils';
import { alertUser } from '@/components/alert/Alert';
import { CopyableInput } from '@/components/copy/Copy';
import { Button } from '@/components/forms';
import { QRCode } from '@/components/qrcode/qrcode';
import style from './info.module.css';

type TProps = {
  account: IAccount;
  info: TSigningConfiguration;
  code: AccountCode;
  signingConfigIndex: number;
  children: ReactNode;
};

export const SigningConfiguration = ({
  account,
  info,
  code,
  signingConfigIndex,
  children,
}: TProps) => {
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
        {bitcoinBased ? <QRCode data={config.keyInfo.xpub} /> : null}
      </div>
      <div className={style.details}>
        {account.isToken ? null : (
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
        {'scriptType' in config ? (
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
          <span>
            {account.coinName} ({account.coinUnit})
          </span>
        </div>
        {bitcoinBased ? (
          <div key="xpub" className={`${style.entry} ${style.largeEntry}`}>
            <strong className="m-right-half">
              {t('accountInfo.extendedPublicKey')}:
            </strong>
            <CopyableInput
              className="flex-grow"
              alignLeft
              flexibleHeight
              value={config.keyInfo.xpub}
            />
          </div>
        ) : null}
      </div>
      <div className={style.buttons}>
        {bitcoinBased ? (
          <Button
            className={style.verifyButton}
            primary
            disabled={verifying}
            onClick={async () => {
              setVerifying(true);
              try {
                const result = await verifyXPub(code, signingConfigIndex);
                if (!result.success) {
                  alertUser(result.errorMessage);
                }
              } finally {
                setVerifying(false);
              }
            }}
          >
            {t('accountInfo.verify')}
          </Button>
        ) : (
          <Button
            className={style.verifyButton}
            primary
            onClick={() => navigate(`/account/${code}/receive`)}
          >
            {t('receive.verify')}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
};
