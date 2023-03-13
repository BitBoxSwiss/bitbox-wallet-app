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

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from '../../../utils/route';
import { getCanVerifyXPub, IAccount, TBitcoinSimple, TEthereumSimple, TSigningConfiguration, verifyXPub } from '../../../api/account';
import { getScriptName, isBitcoinBased } from '../utils';
import { CopyableInput } from '../../../components/copy/Copy';
import { Button } from '../../../components/forms';
import { QRCode } from '../../../components/qrcode/qrcode';
import style from './info.module.css';
import { useLoad } from '../../../hooks/api';

type TProps = {
    account: IAccount;
    info: TSigningConfiguration;
    code: string;
    signingConfigIndex: number;
    children: ReactNode;
}

export const SigningConfiguration = ({ account, info, code, signingConfigIndex, children }: TProps) => {
  const canVerifyExtendedPublicKey = useLoad(getCanVerifyXPub(code));
  const { t } = useTranslation();

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
            data={config.keyInfo.xpub} />
        ) : null }
      </div>
      <div className={style.details}>
        <div className="labelLarge">
          { account.isToken ? null : (
            <p key="accountname" className={style.entry}>
              {/* borrowing translation from accountSummary */}
              <strong>{t('accountSummary.name')}:</strong>
              <span>{account.name}</span>
            </p>
          )}
          <p key="keypath" className={style.entry}>
            <strong>Keypath:</strong>
            <code>{config.keyInfo.keypath}</code>
          </p>
          { ('scriptType' in config) ? (
            <p key="scriptName" className={style.entry}>
              <strong>{t('accountInfo.scriptType')}:</strong>
              <span>{getScriptName(config.scriptType)}</span>
            </p>
          ) : null}
          <p key="coinName" className={style.entry}>
            <strong>{account.isToken ? 'Token' : 'Coin'}:</strong>
            <span>{account.coinName} ({account.coinUnit})</span>
          </p>
          { bitcoinBased ? (
            <p key="xpub" className={`${style.entry} ${style.largeEntry}`}>
              <strong className="m-right-half">
                {t('accountInfo.extendedPublicKey')}:
              </strong>
              <CopyableInput
                className="flex-grow"
                alignLeft
                flexibleHeight
                value={config.keyInfo.xpub} />
            </p>
          ) : null }
        </div>
      </div>
      <div className={style.buttons}>
        { canVerifyExtendedPublicKey ? (
          <Button className={style.verifyButton} primary onClick={() => verifyXPub(code, signingConfigIndex)}>
            {t('accountInfo.verify')}
          </Button>
        ) : bitcoinBased ? null : (
          <Button className={style.verifyButton} primary onClick={() => route(`/account/${code}/receive`)}>
            {t('receive.verify')}
          </Button>
        ) }
        {children}
      </div>
    </div>
  );
};