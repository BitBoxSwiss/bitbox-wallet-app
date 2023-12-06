/**
 * Copyright 2023 Shift Crypto AG
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
import { useTranslation } from 'react-i18next';
import { route } from '../../utils/route';
import { IAccount } from '../../api/account';
import { BitsuranceGuide } from './guide';
import { AccountSelector, TOption, setOptionBalances } from '../../components/accountselector/accountselector';
import { GuidedContent, GuideWrapper, Header, Main } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { View, ViewContent } from '../../components/view/view';
import { bitsuranceLookup } from '../../api/bitsurance';
import { alertUser } from '../../components/alert/Alert';

type TProps = {
    accounts: IAccount[];
    code: string;
}

export const BitsuranceAccount = ({ code, accounts }: TProps) => {
  const [selected, setSelected] = useState<string>(code);
  const [btcAccounts, setBtcAccounts] = useState<TOption[]>();

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
    const options = accounts
      // btc accounts that have never been insured, or with a canceled
      // insurance contract, can be used to make a new contract.
      .filter(account => account.coinCode === 'btc' &&
          (!account.bitsuranceStatus
           || account.bitsuranceStatus === 'canceled'
           || account.bitsuranceStatus === 'refused'))
      .map(({ name, code, coinCode }) => (
        { label: name, value: code, coinCode, disabled: false }
      ));
    setBtcAccounts(await setOptionBalances(options));
  }, [accounts]);

  // check supported accounts
  useEffect(() => {
    detect();
  }, [detect]);

  // if there is only one account available let's automatically redirect to the widget
  useEffect(() => {
    if (btcAccounts !== undefined && btcAccounts.length === 1) {
      route(`/bitsurance/widget/${btcAccounts[0].value}`);
    }
  }, [btcAccounts]);


  const handleProceed = () => {
    route(`/bitsurance/widget/${selected}`);
  };
  if (btcAccounts === undefined) {
    return <Spinner guideExists={false} text={t('loading')} />;
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
                <AccountSelector
                  title={t('bitsuranceAccount.select')}
                  options={btcAccounts}
                  selected={selected}
                  onChange={handleChangeAccount}
                  onProceed={handleProceed} />
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <BitsuranceGuide/>
      </GuideWrapper>
    </Main>
  );
};
