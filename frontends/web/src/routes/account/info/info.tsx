// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLoad, useSync } from '@/hooks/api';
import { getInfo, TAccount, AccountCode, TStatus, getStatus, exportAccount, getTransactionList, TTransactions, TSigningConfiguration } from '@/api/account';
import { findAccount, isBitcoinBased, isBitcoinOnly, isMessageSigningSupported } from '@/routes/account/utils';
import { Header } from '@/components/layout';
import { BackButton } from '@/components/backbutton/backbutton';
import { SigningConfiguration } from './signingconfiguration';
import { Message } from '@/components/message/message';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { OutlinedFileProtect, OutlinedQRCode, OutlinedUnorderedList, OutlinedUpload } from '@/components/icon';
import { alertUser } from '@/components/alert/Alert';
import { statusChanged } from '@/api/accountsync';
import style from './info.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
};

export const Info = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const info = useLoad(getInfo(code));
  const [viewXPub, setViewXPub] = useState<number>(0);
  const [showXPub, setShowXPub] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<TTransactions>();
  const status: TStatus | undefined = useSync(
    () => getStatus(code),
    cb => statusChanged(code, cb),
  );

  useEffect(() => {
    getTransactionList(code)
      .then(setTransactions)
      .catch(console.error);
  }, [code]);

  useEffect(() => {
    setShowXPub(false);
    setViewXPub(0);
  }, [code]);

  const hasTransactions = transactions?.success && transactions.list.length > 0;

  const account = findAccount(accounts, code);
  if (!account || !info) {
    return null;
  }

  const numberOfXPubs = info.signingConfigurations.length;
  if (numberOfXPubs === 0) {
    return null;
  }
  const safeViewXPub = Math.max(0, Math.min(viewXPub, numberOfXPubs - 1));
  const config = info.signingConfigurations[safeViewXPub] as TSigningConfiguration;
  const xpubTypes = info.signingConfigurations.map(cfg => cfg.bitcoinSimple?.scriptType);

  const showNextXPub = () => {
    if (!info) {
      return;
    }
    const numberOfXPubs = info.signingConfigurations.length;
    setViewXPub(prev => (prev + 1) % numberOfXPubs);
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

  const xpubType = xpubTypes[(safeViewXPub + 1) % numberOfXPubs];

  const isBtcBased = isBitcoinBased(account.coinCode);
  const isBtcOnly = isBitcoinOnly(account.coinCode);
  const canSignMessage = isMessageSigningSupported(account.coinCode);

  // Menu view
  if (!showXPub) {
    return (
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header hideSidebarToggler centerTitle title={<h2>{t('accountInfo.title')}</h2>} />
          <div className="content padded">
            <div className={style.menuSection}>
              <div className={style.menuList}>
                <ActionableItem
                  leadingIcon={<OutlinedUpload className={style.actionIcon} aria-hidden alt="" />}
                  onClick={handleExport}
                  disabled={!hasTransactions}
                >
                  {t('accountInfo.exportTransactions')}
                </ActionableItem>
                {isBtcBased && (
                  <ActionableItem
                    leadingIcon={<OutlinedQRCode className={style.actionIcon} aria-hidden alt="" />}
                    onClick={() => setShowXPub(true)}
                  >
                    {t('accountInfo.viewXPub')}
                  </ActionableItem>
                )}
                {canSignMessage && (
                  <ActionableItem
                    leadingIcon={<OutlinedFileProtect className={style.actionIcon} aria-hidden alt="" />}
                    onClick={() => navigate(`/account/${code}/sign-message`)}
                  >
                    {t('accountInfo.signMessage')}
                  </ActionableItem>
                )}
                {isBtcOnly && (
                  <ActionableItem
                    leadingIcon={<OutlinedUnorderedList className={style.actionIcon} aria-hidden alt="" />}
                    onClick={() => navigate(`/account/${code}/addresses`)}
                  >
                    {t('accountInfo.usedAddresses')}
                  </ActionableItem>
                )}
              </div>
              <div className={style.footerButtons}>
                <BackButton to={`/account/${code}`} replace={true} enableEsc>
                  {t('button.back')}
                </BackButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // xPub detail view
  return (
    <div className="container">
      <div className="innerContainer scrollableContainer">
        <Header hideSidebarToggler centerTitle title={<h2>{t('accountInfo.extendedPublicKey')}</h2>} />
        <div className="content padded">
          <div className={style.pageSection}>
            <div className={style.detailCard}>
              {(config?.bitcoinSimple !== undefined && numberOfXPubs > 1) && (
                <p className={style.xPubInfo}>
                  {t('accountInfo.xpubTypeInfo', {
                    current: `${safeViewXPub + 1}`,
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
              )}
              {(config?.bitcoinSimple?.scriptType === 'p2tr') ? (
                <>
                  <Message type="info">
                    {t('accountInfo.taproot')}
                  </Message>
                  <div className="buttons">
                    <BackButton onBack={() => setShowXPub(false)} enableEsc>
                      {t('button.back')}
                    </BackButton>
                  </div>
                </>
              ) : (
                <SigningConfiguration
                  key={safeViewXPub}
                  account={account}
                  code={code}
                  info={config}
                  signingConfigIndex={safeViewXPub}>
                  <BackButton onBack={() => setShowXPub(false)} enableEsc>
                    {t('button.back')}
                  </BackButton>
                </SigningConfiguration>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
