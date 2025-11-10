/**
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { getVendorSupportedAccounts } from './utils';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { MarketGuide } from './guide';
import { connectKeystore } from '@/api/keystores';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

export const MarketInfo = ({ code, accounts }: TProps) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(code);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [supportedAccounts, setSupportedAccounts] = useState<accountApi.TAccount[]>();

  const { t } = useTranslation();

  useEffect(() => {
    try {
      getVendorSupportedAccounts(accounts).then(vendorSupportedAccounts => {
        setSupportedAccounts(vendorSupportedAccounts);
      });
    } catch (e) {
      console.error(e);
    }
  }, [accounts]);

  useEffect(() => {
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
  }, [supportedAccounts, navigate]);

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
              { !supportedAccounts || supportedAccounts.length === 0 ? (
                <div className="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
              ) : (
                supportedAccounts && (
                  <GroupedAccountSelector
                    accounts={supportedAccounts}
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
