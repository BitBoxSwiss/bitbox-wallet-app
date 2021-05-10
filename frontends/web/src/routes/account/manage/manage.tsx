/**
 * Copyright 2021 Shift Crypto AG
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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import * as accountApi from '../../../api/account';
import * as backendAPI from '../../../api/backend';
import SimpleMarkup from '../../../utils/simplemarkup';
import { alertUser } from '../../../components/alert/Alert';
import { Button, Input } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Step, Steps } from './components/steps';
import { CoinDropDown } from './components/coin-dropdown';
import * as styles from '../manage/manage.css';
import checkicon from '../../../assets/icons/check.svg';
import { apiPost } from '../../../utils/request';

interface AddAccountProps {
}

type Props = AddAccountProps & TranslateProps;

interface State {
    accountName: string;
    coinCode: 'choose' | accountApi.CoinCode;
    step: 0 | 1 | 2;
    supportedCoins: backendAPI.ICoin[];
}

class ManageAccount extends Component<Props, State> {
    public readonly state: State = {
        accountName: '',
        coinCode: 'choose',
        step: 0,
        supportedCoins: [],
    };

    private onlyOneSupportedCoin = (): boolean => {
        return this.state.supportedCoins.length === 1;
    }

    public componentDidMount() {
        backendAPI.getSupportedCoins()
            // TEST with only 1 coin
            // .then(() => (['btc']))
            .then((coins) => {
                const onlyOneSupportedCoin = (coins.length === 1);
                this.setState({
                    // @ts-ignore
                    coinCode: onlyOneSupportedCoin ? coins[0] : 'choose',
                    supportedCoins: coins
                });
            })
            .catch(console.error);
    }

    private getStep = () => {
        const { step } = this.state;
        if (this.onlyOneSupportedCoin()) {
            return step === 0 ? 'choose-name' : 'success';
        }
        switch (step) {
            case 0: return 'select-coin';
            case 1: return 'choose-name';
            case 2: return 'success';
        }
    }

    private back = () => {
        this.setState(({ step }) => {
            switch (step) {
                case 0:
                case 1: return ({ step: 0 });
                case 2: return ({ step: 1 });
            }
        });
    }

    private next = () => {
        const { accountName, coinCode } = this.state;
        switch (this.getStep()) {
            case 'select-coin':
                console.info(`${coinCode} selected`);
                this.setState({ step: 1 });
                break;
            case 'choose-name':
                interface ResponseData {
                    success: boolean;
                    errorCode?: 'alreadyExists' | 'limitReached';
                    errorMessage?: string;
                }

                apiPost('account-add', {
                    coinCode,
                    name: accountName,
                }).then((data: ResponseData) => {
                    if (data.success) {
                        this.setState({ step: 2 });
                        //route('/account/' + data.accountCode);
                    } else {
                        if (data.errorCode) {
                            alertUser(this.props.t(`addAccount.error.${data.errorCode}`));
                        } else if (data.errorMessage) {
                            alertUser(this.props.t('unknownError', { errorMessage: data.errorMessage }));
                        }
                    }
                });
                break;
            case 'success':
                route('/account-summary');
                return;
        }
    }

    private renderContent = () => {
        const { t } = this.props;
        const { accountName, coinCode, supportedCoins } = this.state;
        switch (this.getStep()) {
            case 'select-coin':
                return (
                    <CoinDropDown
                        onChange={(coinCode) => this.setState({ coinCode })}
                        supportedCoins={supportedCoins}
                        value={coinCode} />
                );
            case 'choose-name':
                return (
                    <Input
                        id="accountName"
                        onInput={e => this.setState({ accountName: e.target.value })}
                        placeholder={t('addAccount.accountName')}
                        value={accountName} />
                );
            case 'success':
                return (
                    <div className="text-center">
                        <img src={checkicon} className={styles.successCheck} /><br />
                        <SimpleMarkup
                            markup={t('manageAccounts.success.message', { accountName })}
                            tagName="p" />

                    </div>
                );
        }
    }

    public render(
        { t }: RenderableProps<Props>,
        {
            accountName,
            coinCode,
            step,
            supportedCoins,
        }: Readonly<State>
    ) {
        if (supportedCoins.length === 0) {
            return null;
        }
        const logicalStep = this.getStep();
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('manageAccounts.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content narrow isVerticallyCentered">
                        <div className="box large" style="min-height: 370px;">
                            <div className="text-center">
                                {t('manageAccounts.addAccount')}
                                <h1 class={styles.title}>{t(`manageAccounts.${logicalStep}.title`)}</h1>
                            </div>
                            <div class="row">
                                {this.renderContent()}
                            </div>
                            <div class="row">
                                <Steps current={step}>
                                    <Step key="select-coin" hidden={this.onlyOneSupportedCoin()}>
                                        {t('manageAccounts.select-coin.step')}
                                    </Step>
                                    <Step key="choose-name">
                                    {t('manageAccounts.choose-name.step')}
                                    </Step>
                                    <Step key="success">
                                        {t('manageAccounts.success.step')}
                                    </Step>
                                </Steps>
                            </div>
                            <div class="row flex flex-row flex-between flex-start m-bottom">
                                <Button
                                    onClick={this.back}
                                    disabled={step === 0}
                                    transparent>
                                    {t('button.back')}
                                </Button>
                                <Button
                                    disabled={
                                        (logicalStep === 'select-coin' && coinCode === 'choose')
                                        || (logicalStep === 'choose-name' && accountName === '')
                                    }
                                    onClick={this.next}
                                    primary>
                                    {t(`manageAccounts.${logicalStep}.nextButton`)}
                                </Button>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.accountInfo.xpub" entry={t('guide.accountInfo.xpub')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<AddAccountProps>()(ManageAccount);

export { HOC as ManageAccount };
