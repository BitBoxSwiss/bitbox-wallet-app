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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IAccount } from '../../api/account';
import { bitsuranceLookup } from '../../api/bitsurance';
import { Button } from '../../components/forms';
import { GuidedContent, GuideWrapper, Header, Main } from '../../components/layout';
import { View, ViewContent } from '../../components/view/view';
import Guide from './guide';

type TProps = {
    accounts: IAccount[];
}

export const Bitsurance = ({ accounts }: TProps) => {
  const { t } = useTranslation();

  const [insuredAccounts, setInsuredAccounts] = useState<IAccount[]>([]);

  useEffect(() => {
    for (const account of accounts) {
      if (account.bitsuranceId) {
        setInsuredAccounts(insuredAccounts => [...insuredAccounts, account]);
      }
    }
    return () => setInsuredAccounts([]);
  }, [accounts]);

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('sidebar.insurance')}</h2>} />
          <View width="550px" verticallyCentered fullscreen={false}>
            <ViewContent>
              {
              //This is just a placeholder for now.
              }
              { insuredAccounts.length > 0 && (
                <div>
                  <div>Already insured accounts:</div>
                  <ul>
                    {insuredAccounts.map(account => <li key={account.code}>{account.code} - {account.bitsuranceId}</li>)}
                  </ul>
                </div>
              ) }
              <Button onClick={() => bitsuranceLookup()} primary><span>Check for insured accounts</span></Button>
            </ViewContent>
          </View>
        </GuidedContent>
        <Guide/>
      </GuideWrapper>
    </Main>
  );
};
