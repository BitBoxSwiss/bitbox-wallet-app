/**
 * Copyright 2018 Shift Devices AG
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

import * as accountApi from '../../../api/account';
import { Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { useTranslation } from 'react-i18next';
import { View, ViewContent } from '../../../components/view/view';

type Props = {
  accounts: accountApi.IAccount[];
  code: string;
};

export function Receive({ accounts, code }: Props) {
  const { t } = useTranslation();

  const account = accounts && accounts.find((acct) => acct.code === code);
  if (!account) {
    return null;
  }

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('receive.title', { accountName: account.coinName })}</h2>} />
          <View>
            <ViewContent>
              <Grid children={undefined}></Grid>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
}
