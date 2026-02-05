/**
 * Copyright 2025 Shift Crypto AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TAccount } from '@/api/account';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Button, Label } from '@/components/forms';
import { SwapServiceSelector } from './components/swap-service-selector';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { ArrowSwap } from '@/components/icon';
import style from './swap.module.css';

type Props = {
  accounts: TAccount[];
  code: AccountCode;
};

export const Swap = ({
  accounts,
  code,
}: Props) => {
  const { t } = useTranslation();

  // Send
  const [fromAccountCode, setFromAccountCode] = useState<string>();
  const [swapSendAmount, setSwapSendAmount] = useState<string>('0.1');
  // Receive
  const [toAccountCode, setToAccountCode] = useState<string>();
  const [swapReceiveAmount, setSwapReceiveAmount] = useState<string>('0.00040741');

  console.log(code, setSwapReceiveAmount);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            hideSidebarToggler
            title={
              <SubTitle>
                Swap
              </SubTitle>
            }
          />
          <View
            fullscreen={false}
            width="600px"
          >
            <ViewContent>
              <div className={style.row}>
                <Label
                  className={style.label}
                  htmlFor="swapSendAmount">
                  <span>
                    {t('generic.send')}
                  </span>
                </Label>
                <Button transparent className={style.maxButton}>
                  Max 0.12345678 BTC
                </Button>
              </div>
              <InputWithAccountSelector
                accounts={accounts}
                id="swapSendAmount"
                accountCode={fromAccountCode}
                onChangeAccountCode={setFromAccountCode}
                value={swapSendAmount}
                onChangeValue={setSwapSendAmount}
              />
              <div className={style.flipContainer}>
                <Button
                  disabled
                  transparent
                  className={style.flipAcconutsButton}>
                  <ArrowSwap className={style.flipAcconutsIcon} />
                </Button>
              </div>
              <div className={style.row}>
                <Label
                  htmlFor="swapGetAmount">
                  <span>
                    {t('generic.receiveWithoutCoinCode')}
                  </span>
                </Label>
                <Button transparent className={style.maxButton}>
                  Max 45678 ETH
                </Button>
              </div>
              <InputWithAccountSelector
                accounts={accounts}
                id="swapGetAmount"
                accountCode={toAccountCode}
                onChangeAccountCode={setToAccountCode}
                value={swapReceiveAmount}
              />
              <SwapServiceSelector />
            </ViewContent>
            <ViewButtons>
              <Button primary>
                {t('generic.swap')}
              </Button>
              <Button secondary>
                {t('button.back')}
              </Button>
            </ViewButtons>
          </View>
        </Main>
      </GuidedContent>
      <Guide>
        <Entry
          key="guide.settings.servers"
          entry={{
            text: t('guide.settings.servers.text'),
            title: t('guide.settings.servers.title'),
          }}
        />
      </Guide>
    </GuideWrapper>
  );
};
