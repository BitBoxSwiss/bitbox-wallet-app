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

import React, { Component, createRef } from 'react';
import * as accountApi from '../../../api/account';
import * as backendAPI from '../../../api/backend';
import { SimpleMarkup } from '../../../utils/markup';
import { Message } from '../../../components/message/message';
import { Button, Input } from '../../../components/forms';
import { Header } from '../../../components/layout';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Step, Steps } from './components/steps';
import { CoinDropDown } from './components/coin-dropdown';
import { Check } from '../../../components/icon/icon';
import { apiPost } from '../../../utils/request';
import Guide from '../../settings/manage-account-guide';
import { route } from '../../../utils/route';
import styles from './add.module.css';

interface AddAccountProps {
}

type Props = AddAccountProps & TranslateProps;

type TStep = 'select-coin' | 'choose-name' | 'success';

interface State {
    accountCode?: string;
    accountName: string;
    coinCode: 'choose' | accountApi.CoinCode;
    errorMessage?: string;
    step: TStep;
    supportedCoins: backendAPI.ICoin[];
    adding: boolean; // true while the backend is working to add the account.
}

class AddAccount extends Component<Props, State> {
  public readonly state: State = {
    accountCode: undefined,
    accountName: '',
    coinCode: 'choose',
    errorMessage: undefined,
    step: 'select-coin',
    supportedCoins: [],
    adding: false,
  };

  private ref = createRef<HTMLInputElement>();

  private onlyOneSupportedCoin = (): boolean => {
    return this.state.supportedCoins.length === 1;
  };

  public componentDidMount() {
    this.startProcess();
  }

  public componentDidUpdate(_prevProps: Props, prevState: State) {
    if ((prevState.step !== this.state.step) && (this.state.step === 'choose-name')) {
      this.ref.current?.focus();
    }
  }

  private startProcess = () => {
    backendAPI.getSupportedCoins()
      .then((coins) => {
        const onlyOneSupportedCoin = (coins.length === 1);
        this.setState({
          coinCode: onlyOneSupportedCoin ? coins[0].coinCode : 'choose',
          step: onlyOneSupportedCoin ? 'choose-name' : 'select-coin',
          supportedCoins: coins,
        });
        if (onlyOneSupportedCoin) {
          this.setState({ accountName: coins[0].suggestedAccountName });
        }
      });
    this.ref.current?.focus();
  };

  private back = () => {
    switch (this.state.step) {
    case 'select-coin':
      route('/settings/manage-accounts');
      break;
    case 'choose-name':
      this.setState({ step: 'select-coin', errorMessage: undefined });
      break;
    case 'success':
      this.setState({ step: 'choose-name' });
      break;
    }
  };

  private next = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const { accountName, accountCode, coinCode, step } = this.state;
    const { t } = this.props;
    switch (step) {
    case 'select-coin':
      this.setState({ step: 'choose-name' });
      break;
    case 'choose-name':
      type ResponseData = {
        success: boolean;
        accountCode?: string;
        errorCode?: 'accountAlreadyExists' | 'accountLimitReached';
        errorMessage?: string;
      };
      this.setState({ adding: true });
      apiPost('account-add', {
        coinCode,
        name: accountName,
      })
        .then((data: ResponseData) => {
          this.setState({ adding: false });
          if (data.success) {
            this.setState({
              accountCode: data.accountCode,
              errorMessage: undefined,
              step: 'success'
            });
          } else if (data.errorCode) {
            this.setState({
              errorMessage: t(`error.${data.errorCode}`)
            });
          } else if (data.errorMessage) {
            this.setState({
              errorMessage: t('unknownError', { errorMessage: data.errorMessage })
            });
          }
        });
      break;
    case 'success':
      if (accountCode) {
        route(`/account/${accountCode}`);
      }
      break;

    }
  };

  private renderContent = () => {
    const { t } = this.props;
    const { accountName, coinCode, step, supportedCoins } = this.state;
    switch (step) {
    case 'select-coin':
      return (
        <CoinDropDown
          onChange={coin => this.setState({ coinCode: coin.coinCode, accountName: coin.suggestedAccountName })}
          supportedCoins={supportedCoins}
          value={coinCode} />
      );
    case 'choose-name':
      return (
        <Input
          autoFocus
          ref={this.ref}
          id="accountName"
          onInput={e => this.setState({ accountName: e.target.value })}
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

  private getTextFor = (step: TStep) => {
    const { t } = this.props;
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

  public render() {
    const { t } = this.props;
    const {
      accountName,
      coinCode,
      errorMessage,
      step,
      supportedCoins,
      adding,
    } = this.state;
    if (supportedCoins.length === 0) {
      return null;
    }
    const currentStep = [
      ...(!this.onlyOneSupportedCoin() ? ['select-coin'] : []),
      'choose-name',
      'success'
    ].indexOf(step);
    const { titleText, nextButtonText } = this.getTextFor(step);
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('manageAccounts.title')}</h2>} />
            <div className="content larger isVerticallyCentered">
              <form
                className={`${styles.manageContainer} box larger flex flex-column flex-between`}
                onSubmit={this.next}>
                <div className="text-center">
                  {t('addAccount.title')}
                  <h1 className={styles.title}>{titleText}</h1>
                </div>
                <div className="row" hidden={!errorMessage}>
                  <Message type="warning">{errorMessage}</Message>
                </div>
                <div className="row">
                  {this.renderContent()}
                </div>
                <div className="row">
                  <Steps current={currentStep}>
                    <Step key="select-coin" hidden={this.onlyOneSupportedCoin()}>
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
                    onClick={this.back}
                    hidden={step === 'success'}
                    transparent>
                    {t('button.back')}
                  </Button>
                  <Button
                    onClick={() => this.setState({
                      accountCode: undefined,
                      accountName: '',
                      coinCode: 'choose',
                      errorMessage: undefined,
                      step: 'select-coin',
                    }, this.startProcess)}
                    hidden={step !== 'success'}
                    transparent>
                    Add another account
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <Guide />
      </div>
    );
  }
}

const HOC = translate()(AddAccount);

export { HOC as AddAccount };
