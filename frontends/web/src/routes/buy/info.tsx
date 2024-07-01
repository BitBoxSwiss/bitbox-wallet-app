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
import { useTranslation } from 'react-i18next';
import { route } from '@/utils/route';
import * as accountApi from '@/api/account';
import { getExchangeSupportedAccounts } from './utils';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { BuyGuide } from './guide';

type TProps = {
    accounts: accountApi.IAccount[];
    code: accountApi.AccountCode;
}

export const BuyInfo = ({ code, accounts }: TProps) => {
  const [selected, setSelected] = useState<string>(code);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [supportedAccounts, setSupportedAccounts] = useState<accountApi.IAccount[]>();

  const { t } = useTranslation();

  useEffect(() => {
    try {
      getExchangeSupportedAccounts(accounts).then(exchangeSupportedAccounts => {
        setSupportedAccounts(exchangeSupportedAccounts);
      });
    } catch (e) {
      console.error(e);
    }
  }, [accounts]);

  useEffect(() => {
    if (supportedAccounts !== undefined && supportedAccounts.length === 1) {
      // If user only has one supported account for exchange
      // and they don't have the correct device connected
      // they'll be prompted to do so.
      const accountCode = supportedAccounts[0].code;
      connectKeystore(accountCode).then(connected => {
        if (connected) {
          route(`/buy/exchange/${accountCode}`);
        }
      });
    }
  }, [supportedAccounts]);

  const handleProceed = async () => {
    setDisabled(true);
    try {
      const connected = await connectKeystore(selected);
      if (connected) {
        route(`/buy/exchange/${selected}`);
      }
    } finally {
      setDisabled(false);
    }
  };

  const connectKeystore = async (keystore: string) => {
    const connectResult = await accountApi.connectKeystore(keystore);
    return connectResult.success;
  };

  if (supportedAccounts === undefined) {
    return <Spinner guideExists={false} text={t('loading')} />;
  }

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const name = hasOnlyBTCAccounts ? 'Bitcoin' : t('buy.info.crypto');

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('buy.info.title', { name })}</h2>}>
            <HideAmountsButton />
          </Header>
          <View width="550px" verticallyCentered fullscreen={false}>
            <ViewContent>
              { !supportedAccounts || supportedAccounts.length === 0 ? (
                <div className="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
              ) : (
                supportedAccounts &&
                      <GroupedAccountSelector
                        accounts={supportedAccounts}
                        title={t('buy.title', { name })}
                        disabled={disabled}
                        selected={selected}
                        onChange={setSelected}
                        onProceed={handleProceed}
                      />
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <BuyGuide name={name} />
      </GuideWrapper>
    </Main>
  );
};
