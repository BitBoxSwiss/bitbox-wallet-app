/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IAccount } from '@/api/account';
import { BitsuranceGuide } from './guide';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewContent } from '@/components/view/view';
import { bitsuranceLookup } from '@/api/bitsurance';
import { alertUser } from '@/components/alert/Alert';
import { connectKeystore } from '@/api/keystores';

type TProps = {
    accounts: IAccount[];
    code: string;
}

export const BitsuranceAccount = ({ code, accounts }: TProps) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(code);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [btcAccounts, setBtcAccounts] = useState<IAccount[]>();

  const { t } = useTranslation();

  const handleChangeAccount = (selected: string) => {
    setSelected(selected);
  };

  const detect = useCallback(async () => {
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }
    // btc accounts that have never been insured, or with a canceled
    // insurance contract, can be used to make a new contract.
    const insurableAccounts = accounts.filter(account => account.coinCode === 'btc' &&
        (!account.bitsuranceStatus
         || account.bitsuranceStatus === 'canceled'
        || account.bitsuranceStatus === 'refused'));
    setBtcAccounts(insurableAccounts);
  }, [accounts]);

  // check supported accounts
  useEffect(() => {
    detect();
  }, [detect]);

  // if there is only one account available let's automatically redirect to the widget
  useEffect(() => {
    if (btcAccounts !== undefined && btcAccounts.length === 1) {
      connectKeystore(btcAccounts[0].keystore.rootFingerprint).then(connectResult => {
        if (!connectResult.success) {
          return;
        }
        // replace current history item when redirecting so that the user can go back
        navigate(`/bitsurance/widget/${btcAccounts[0].code}`, { replace: true });
      });
    }
  }, [btcAccounts, navigate]);

  const handleProceed = async () => {
    setDisabled(true);
    try {
      const account = btcAccounts?.find(acc => acc.code === selected);
      if (account === undefined) {
        return;
      }
      const connectResult = await connectKeystore(account.keystore.rootFingerprint);
      if (!connectResult.success) {
        return;
      }
    } finally {
      setDisabled(false);
    }
    navigate(`/bitsurance/widget/${selected}`);
  };

  if (btcAccounts === undefined) {
    return <Spinner text={t('loading')} />;
  }

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('bitsuranceAccount.title')}</h2>} />
          <View width="550px" verticallyCentered fullscreen={false}>
            <ViewContent>
              { btcAccounts.length === 0 ? (
                <div>{t('bitsuranceAccount.noAccount')}</div>
              ) : (
                <GroupedAccountSelector
                  title={t('bitsuranceAccount.select')}
                  disabled={disabled}
                  accounts={btcAccounts}
                  selected={selected}
                  onChange={handleChangeAccount}
                  onProceed={handleProceed}
                />
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <BitsuranceGuide/>
      </GuideWrapper>
    </Main>
  );
};
