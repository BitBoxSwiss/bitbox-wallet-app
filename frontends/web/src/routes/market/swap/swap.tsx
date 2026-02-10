// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBalance, TBalance, type AccountCode, type TAccount } from '@/api/account';
import { GuideWrapper, GuidedContent, Main, Header } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SubTitle } from '@/components/title';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Button, Label } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { SwapServiceSelector } from './components/swap-service-selector';
import { InputWithAccountSelector } from './components/input-with-account-selector';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { ArrowSwap } from '@/components/icon';
import style from './swap.module.css';

type Props = {
  accounts: TAccount[];
  code: AccountCode;
};

const fetchBlance = async (code: AccountCode) => {
  const response = await getBalance(code);
  if (response.success) {
    return response.balance;
  }
  return;
};

export const Swap = ({
  accounts,
  code,
}: Props) => {
  const { t } = useTranslation();

  // Send
  const [fromAccountCode, setFromAccountCode] = useState<string>(code);
  const [swapSendAmount, setSwapSendAmount] = useState<string>('0');
  const [swapMaxAmount, setSwapMaxAmount] = useState<TBalance | undefined>();
  // Receive
  const [toAccountCode, setToAccountCode] = useState<string>();
  const [swapReceiveAmount, setSwapReceiveAmount] = useState<string>('0');

  useEffect(() => {
    if (fromAccountCode) {
      fetchBlance(fromAccountCode).then(setSwapMaxAmount);
    }
  }, [fromAccountCode]);

  // not used yet, but loggin so we dont get a TS error
  console.log(setSwapReceiveAmount);

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
                {swapMaxAmount && (
                  <Button transparent className={style.maxButton}>
                    Max
                    {' '}
                    <AmountWithUnit amount={swapMaxAmount.available} />
                  </Button>
                )}
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
                  45678 ETH
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
              <BackButton>
                {t('button.back')}
              </BackButton>
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
