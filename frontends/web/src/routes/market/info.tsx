// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import type { TAccountsByKeystore } from '@/api/account';
import { getVendorSupportedAccounts } from './utils';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { MarketGuide } from './guide';
import { connectKeystore } from '@/api/keystores';
import { filterAccountsByKeystore, flattenAccountsByKeystore } from '@/routes/account/utils';

type TProps = {
  accountsByKeystore: TAccountsByKeystore[];
  code: accountApi.AccountCode;
};

export const MarketInfo = ({ code, accountsByKeystore }: TProps) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(code);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [supportedAccountsByKeystore, setSupportedAccountsByKeystore] = useState<TAccountsByKeystore[]>();

  const { t } = useTranslation();
  const accounts = flattenAccountsByKeystore(accountsByKeystore);
  const supportedAccounts = supportedAccountsByKeystore && flattenAccountsByKeystore(supportedAccountsByKeystore);

  useEffect(() => {
    try {
      getVendorSupportedAccounts(flattenAccountsByKeystore(accountsByKeystore)).then(vendorSupportedAccounts => {
        const supportedCodes = new Set(vendorSupportedAccounts.map(({ code }) => code));
        setSupportedAccountsByKeystore(filterAccountsByKeystore(
          accountsByKeystore,
          account => supportedCodes.has(account.code)
        ));
      });
    } catch (e) {
      console.error(e);
    }
  }, [accountsByKeystore]);

  useEffect(() => {
    const supportedAccounts = supportedAccountsByKeystore && flattenAccountsByKeystore(supportedAccountsByKeystore);
    const firstAccount = supportedAccounts && supportedAccounts.length === 1 && supportedAccounts[0];
    if (firstAccount) {
      // If user only has one supported account for vendor
      // and they don't have the correct device connected
      // they'll be prompted to do so.
      const accountCode = firstAccount.code;
      const rootFingerprint = firstAccount.keystore.rootFingerprint;
      connectKeystoreFn(rootFingerprint).then(connected => {
        if (connected) {
          // replace current history item when redirecting so that the user can go back
          navigate(`/market/select/${accountCode}`, { replace: true });
        }
      });
    }
  }, [supportedAccountsByKeystore, navigate]);

  const handleProceed = async () => {
    setDisabled(true);
    try {
      const account = supportedAccounts?.find(acc => acc.code === selected);
      if (account === undefined) {
        return;
      }
      const connected = await connectKeystoreFn(account.keystore.rootFingerprint);
      if (connected) {
        navigate(`/market/select/${selected}`);
      }
    } finally {
      setDisabled(false);
    }
  };

  const connectKeystoreFn = async (keystore: string) => {
    const connectResult = await connectKeystore(keystore);
    return connectResult.success;
  };

  if (supportedAccounts === undefined) {
    return <Spinner text={t('loading')} />;
  }

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={
            <h2>
              {t('generic.buySell')}
            </h2>
          }>
            <HideAmountsButton />
          </Header>
          <View width="550px" verticallyCentered fullscreen={false}>
            <ViewContent>
              { !supportedAccounts || supportedAccounts.length === 0 || !supportedAccountsByKeystore ? (
                <div className="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
              ) : (
                supportedAccountsByKeystore && (
                  <GroupedAccountSelector
                    accountsByKeystore={supportedAccountsByKeystore}
                    title={ t('receive.selectAccount')}
                    disabled={disabled}
                    selected={selected}
                    onChange={setSelected}
                    onProceed={handleProceed}
                  />
                )
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <MarketGuide translationContext={translationContext} />
      </GuideWrapper>
    </Main>
  );
};
