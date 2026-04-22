// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';
import { TAccount, AccountCode, TStatus, getStatus, exportAccount, getTransactionList, TTransactions } from '@/api/account';
import { findAccount, isBitcoinBased, isMessageSigningSupported } from '@/routes/account/utils';
import { TDevices } from '@/api/devices';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { BackButton } from '@/components/backbutton/backbutton';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { QRCodeLight, QRCodeDark, OutlinedUploadDark, OutlinedUploadLight, OutlinedUnorderedListDark, OutlinedUnorderedListLight, OutlinedFileProtectDark, OutlinedFileProtectLight } from '@/components/icon';
import { useDarkmode } from '@/hooks/darkmode';
import { alertUser } from '@/components/alert/Alert';
import { statusChanged, syncdone } from '@/api/accountsync';
import style from './info.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
  devices: TDevices;
};

export const Info = ({
  accounts,
  code,
  devices,
}: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const navigate = useNavigate();
  const status: TStatus | undefined = useSync(
    () => getStatus(code),
    cb => statusChanged(code, cb),
  );
  const accountReady = (
    status !== undefined
    && !status.fatalError
    && status.synced
    && status.offlineError === null
  );
  const mounted = useMountedRef();
  const [transactions, setTransactions] = useState<TTransactions | undefined>();

  useEffect(() => {
    if (!accountReady) {
      setTransactions(undefined);
      return;
    }
    const fetch = () => {
      getTransactionList(code)
        .then(txs => {
          if (mounted.current) {
            setTransactions(txs);
          }
        })
        .catch(console.error);
    };
    fetch();
    return syncdone(code, fetch);
  }, [code, accountReady, mounted]);

  const transactionsLoaded = transactions?.success === true;
  const hasTransactions = transactionsLoaded && transactions.list.length > 0;

  const account = findAccount(accounts, code);
  if (!account) {
    return null;
  }

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

  const isBtcBased = isBitcoinBased(account.coinCode);
  const canSignMessage = isMessageSigningSupported(account.coinCode);

  return (
    <Main>
      <ContentWrapper>
        <GlobalBanners devices={devices} />
      </ContentWrapper>
      <Header hideSidebarToggler title={
        <>
          <h2 className="hide-on-small">{t('accountInfo.title')}</h2>
          <MobileHeader onClick={() => navigate(-1)} title={t('accountInfo.title')} />
        </>
      } />
      <View fullscreen={false}>
        <ViewContent>
          <div className={style.menuList}>
            <ActionableItem
              onClick={handleExport}
              disabled={hasTransactions !== true}
            >
              <div className={style.actionItem}>
                {isDarkMode ? <OutlinedUploadLight className={style.actionIcon} aria-hidden alt="" /> : <OutlinedUploadDark className={style.actionIcon} aria-hidden alt="" />}
                <div className={style.actionText}>
                  <span>{t('accountInfo.exportTransactions')}</span>
                  {transactionsLoaded && !hasTransactions && (
                    <span className={style.actionHint}>{t('accountInfo.exportTransactionsDisabled')}</span>
                  )}
                </div>
              </div>
            </ActionableItem>
            <ActionableItem
              onClick={() => navigate(`/account/${code}/info/xpub-detail`)}
            >
              <div className={style.actionItem}>
                {isDarkMode ? <QRCodeLight className={style.actionIcon} aria-hidden alt="" /> : <QRCodeDark className={style.actionIcon} aria-hidden alt="" />}
                <span>{t('accountInfo.viewAccountDetails')}</span>
              </div>
            </ActionableItem>
            {canSignMessage && (
              <ActionableItem
                onClick={() => navigate(`/account/${code}/sign-message`)}
              >
                <div className={style.actionItem}>
                  {isDarkMode ?
                    <OutlinedFileProtectLight className={style.actionIcon} aria-hidden alt="" /> :
                    <OutlinedFileProtectDark className={style.actionIcon} aria-hidden alt="" />
                  }
                  <span>{t('signMessage.signMessage')}</span>
                </div>
              </ActionableItem>
            )}
            {isBtcBased && (
              <ActionableItem
                onClick={() => navigate(`/account/${code}/addresses`)}
              >
                <div className={style.actionItem}>
                  {isDarkMode ?
                    <OutlinedUnorderedListLight className={style.actionIcon} aria-hidden alt="" /> :
                    <OutlinedUnorderedListDark className={style.actionIcon} aria-hidden alt="" />
                  }
                  <span>{t('accountInfo.usedAddresses')}</span>
                </div>
              </ActionableItem>
            )}
          </div>
          <div className={`${style.footerButtons || ''} hide-on-small`}>
            <BackButton enableEsc>
              {t('button.back')}
            </BackButton>
          </div>
        </ViewContent>
      </View>
    </Main>
  );
};
