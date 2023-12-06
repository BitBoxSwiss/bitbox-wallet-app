/**
 * Copyright 2022 Shift Crypto AG
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as backendAPI from '../../../api/backend';
import * as keystoresAPI from '../../../api/keystores';
import { SimpleMarkup } from '../../../utils/markup';
import { Message } from '../../../components/message/message';
import { Button, Input } from '../../../components/forms';
import { Header } from '../../../components/layout';
import { Step, Steps } from './components/steps';
import { CoinDropDown } from './components/coin-dropdown';
import { Check } from '../../../components/icon/icon';
import { AccountGuide } from '../../settings/manage-account-guide';
import { route } from '../../../utils/route';
import { addAccount, CoinCode, TAddAccount } from '../../../api/account';
import styles from './add.module.css';


type TStep = 'select-coin' | 'choose-name' | 'success';

export const AddAccount = () => {
  const [accountCode, setAccountCode] = useState<string>();
  const [accountName, setAccountName] = useState('');
  const [coinCode, setCoinCode] = useState<'choose' | CoinCode>('choose');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [step, setStep] = useState<TStep>('select-coin');
  const [supportedCoins, setSupportedCoins] = useState<backendAPI.ICoin[]>([]);
  const [adding, setAdding] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const { t } = useTranslation();

  useEffect(() => {
    if (step === 'choose-name') {
      inputRef.current?.focus();
    }
  }, [step]);

  const onlyOneSupportedCoin = (): boolean => {
    return supportedCoins.length === 1;
  };

  const startProcess = useCallback(async () => {
    try {
      const coins = await backendAPI.getSupportedCoins();
      const onlyOneCoinIsSupported = (coins.length === 1);
      setCoinCode(onlyOneCoinIsSupported ? coins[0].coinCode : 'choose');
      setStep(onlyOneCoinIsSupported ? 'choose-name' : 'select-coin');
      setSupportedCoins(coins);
      if (onlyOneCoinIsSupported) {
        setAccountCode(coins[0].suggestedAccountName);
      }
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    startProcess();

    const unsubscribe = keystoresAPI.subscribeKeystores(() => {
      startProcess();
    });
    return unsubscribe;
  }, [startProcess]);

  const back = () => {
    switch (step) {
    case 'select-coin':
      route('/settings/manage-accounts');
      break;
    case 'choose-name':
      setStep('select-coin');
      setErrorMessage(undefined);
      break;
    case 'success':
      setStep('choose-name');
      break;
    }
  };

  const next = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    switch (step) {
    case 'select-coin':
      setStep('choose-name');
      break;
    case 'choose-name':
      setAdding(true);
      const responseData: TAddAccount = await addAccount(coinCode, accountName);
      setAdding(false);
      if (responseData.success) {
        setAccountCode(responseData.accountCode);
        setErrorMessage(undefined);
        setStep('success');
      } else if (responseData.errorCode) {
        setErrorMessage(t(`error.${responseData.errorCode}`));
      } else if (responseData.errorMessage) {
        setErrorMessage(t('unknownError', { errorMessage: responseData.errorMessage }));
      }

      break;
    case 'success':
      if (accountCode) {
        route(`/account/${accountCode}`);
      }
      break;
    }
  };

  const renderContent = () => {
    switch (step) {
    case 'select-coin':
      if (supportedCoins.length === 0) {
        return (
          <Message type="info">
            {t('connectKeystore.promptNoName')}
          </Message>
        );
      }
      return (
        <CoinDropDown
          onChange={coin => {
            setCoinCode(coin.coinCode);
            setAccountName(coin.suggestedAccountName);
          }}
          supportedCoins={supportedCoins}
          value={coinCode} />
      );
    case 'choose-name':
      return (
        <Input
          autoFocus
          ref={inputRef}
          id="accountName"
          onInput={e => setAccountName(e.target.value)}
          value={accountName} />
      );
    case 'success':
      return (
        <div className="text-center">
          <Check className={styles.successCheck} /><br />
          <SimpleMarkup
            className={styles.successMessage}
            markup={t('addAccount.success.message', { accountName })}
            tagName="p" />
        </div>
      );
    }
  };

  const getTextFor = (step: TStep) => {
    switch (step) {
    case 'select-coin':
      return {
        titleText: t('addAccount.selectCoin.title'),
        nextButtonText: t('addAccount.selectCoin.nextButton'),
      };
    case 'choose-name':
      return {
        titleText: t('addAccount.chooseName.title'),
        nextButtonText: t('addAccount.chooseName.nextButton'),
      };
    case 'success':
      return {
        titleText: t('addAccount.success.title'),
        nextButtonText: t('addAccount.success.nextButton'),
      };
    }
  };

  const handleAddAnotherAccount = async () => {
    setAccountCode(undefined);
    setAccountName('');
    setCoinCode('choose');
    setErrorMessage(undefined);
    setStep('select-coin');
    await startProcess();
  };

  const currentStep = [
    ...(!onlyOneSupportedCoin() ? ['select-coin'] : []),
    'choose-name',
    'success'
  ].indexOf(step);
  const { titleText, nextButtonText } = getTextFor(step);
  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('manageAccounts.title')}</h2>} />
          <div className="content larger isVerticallyCentered">
            <form
              className={`${styles.manageContainer} box larger flex flex-column flex-between`}
              onSubmit={next}>
              <div className="text-center">
                {t('addAccount.title')}
                <h1 className={styles.title}>{titleText}</h1>
              </div>
              <div className="row" hidden={!errorMessage}>
                <Message type="warning">{errorMessage}</Message>
              </div>
              <div className="row">
                {renderContent()}
              </div>
              <div className="row">
                <Steps current={currentStep}>
                  <Step key="select-coin" hidden={onlyOneSupportedCoin()}>
                    {t('addAccount.selectCoin.step')}
                  </Step>
                  <Step key="choose-name">
                    {t('addAccount.chooseName.step')}
                  </Step>
                  <Step key="success">
                    {t('addAccount.success.step')}
                  </Step>
                </Steps>
              </div>
              <div className="row flex flex-row flex-between m-bottom" style={{ flexDirection: 'row-reverse' }}>
                <Button
                  disabled={
                    (step === 'select-coin' && coinCode === 'choose')
                    || (step === 'choose-name' && (accountName === '' || adding))
                  }
                  primary
                  type="submit">
                  {nextButtonText}
                </Button>
                <Button
                  onClick={back}
                  hidden={step === 'success'}
                  secondary>
                  {t('button.back')}
                </Button>
                <Button
                  onClick={handleAddAnotherAccount}
                  hidden={step !== 'success'}
                  secondary>
                  {t('addAccount.success.addAnotherAccount')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <AccountGuide />
    </div>
  );
};
