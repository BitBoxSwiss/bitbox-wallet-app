/**
 * Copyright 2018 Shift Devices AG
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad, useSync } from '@/hooks/api';
import { getInfo, IAccount, AccountCode, IStatus, getStatus, exportAccount, getTransactionList, TTransactions, TSigningConfiguration } from '@/api/account';
import { isBitcoinBased } from '@/routes/account/utils';
import { Header } from '@/components/layout';
import { BackButton } from '@/components/backbutton/backbutton';
import { SigningConfiguration } from './signingconfiguration';
import { BitcoinBasedAccountInfoGuide } from './guide';
import { Message } from '@/components/message/message';
import { Button } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { statusChanged } from '@/api/accountsync';
import style from './info.module.css';

type TProps = {
  accounts: IAccount[];
  code: AccountCode;
};

export const Info = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const info = useLoad(getInfo(code));
  const [viewXPub, setViewXPub] = useState<number>(0);
  const [transactions, setTransactions] = useState<TTransactions>();
  const status: IStatus | undefined = useSync(
    () => getStatus(code),
    cb => statusChanged(code, cb),
  );

  useEffect(() => {
    getTransactionList(code)
      .then(setTransactions)
      .catch(console.error);
  }, [code]);

  const hasTransactions = transactions?.success && transactions.list.length > 0;

  const account = accounts.find(({ code: accountCode }) => accountCode === code);
  if (!account || !info) {
    return null;
  }

  const config = info.signingConfigurations[viewXPub] as TSigningConfiguration;
  const numberOfXPubs = info.signingConfigurations.length;
  const xpubTypes = info.signingConfigurations.map(cfg => cfg.bitcoinSimple?.scriptType);

  const showNextXPub = () => {
    if (!info) {
      return;
    }
    const numberOfXPubs = info.signingConfigurations.length;
    setViewXPub((viewXPub + 1) % numberOfXPubs);
  };

  const handleExport = async () => {
    if (status === undefined || status.fatalError) {
      return;
    }
    try {
      const exportedResult = await exportAccount(code);
      if (exportedResult !== null && !exportedResult.success) {
        alertUser(exportedResult.errorMessage);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const xpubType = xpubTypes[(viewXPub + 1) % numberOfXPubs];

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('accountInfo.title')}</h2>} />
          <div className="content padded">
            <div className="box larger">
              { isBitcoinBased(account.coinCode) ? (
                <h2 className={style.title}>
                  {t('accountInfo.extendedPublicKey')}
                </h2>
              ) : null }
              { (config?.bitcoinSimple !== undefined && numberOfXPubs > 1) ? (
                <p className={style.xPubInfo}>
                  {t('accountInfo.xpubTypeInfo', {
                    current: `${viewXPub + 1}`,
                    numberOfXPubs: numberOfXPubs.toString(),
                    scriptType: config.bitcoinSimple.scriptType.toUpperCase(),
                  })}
                  <br />
                  {xpubType && (
                    <button className={style.nextButton} onClick={showNextXPub}>
                      {t(`accountInfo.xpubTypeChangeBtn.${xpubType}`)}
                    </button>
                  )}
                </p>
              ) : null}
              <Button
                transparent
                disabled={!hasTransactions}
                className={style.exportButton}
                onClick={handleExport}
                title={t('account.exportTransactions')}>
                {t('account.export')}
              </Button>
              { (config?.bitcoinSimple?.scriptType === 'p2tr') ? (
                <>
                  <Message type="info">
                    {t('accountInfo.taproot')}
                  </Message>
                  <BackButton enableEsc>
                    {t('button.back')}
                  </BackButton>
                </>
              ) : (
                <SigningConfiguration
                  key={viewXPub}
                  account={account}
                  code={code}
                  info={config}
                  signingConfigIndex={viewXPub}>
                  <BackButton enableEsc>
                    {t('button.back')}
                  </BackButton>
                </SigningConfiguration>
              )}
            </div>
          </div>
        </div>
      </div>
      { isBitcoinBased(account.coinCode) ? (
        <BitcoinBasedAccountInfoGuide coinName={account.coinName} />
      ) : null }
    </div>
  );
};
