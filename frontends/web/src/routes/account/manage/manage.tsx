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
    step: 'select-coin' | 'choose-name' | 'success';
    supportedCoins: backendAPI.ICoin[];
}

class ManageAccount extends Component<Props, State> {
    public readonly state: State = {
        accountName: '',
        coinCode: 'choose',
        step: 'select-coin',
        supportedCoins: [],
    };

    private onlyOneSupportedCoin = (): boolean => {
        return this.state.supportedCoins.length === 1;
    }

    public componentDidMount() {
        backendAPI.getSupportedCoins()
            // TEST with only 1 coin
            // .then(() => ([{coinCode: 'tbtc', name: 'Bitcoin Testnet', canAddAccount: true}]))
            .then((coins) => {
                const onlyOneSupportedCoin = (coins.length === 1);
                this.setState({
                    coinCode: onlyOneSupportedCoin ? coins[0].coinCode : 'choose',
                    step: onlyOneSupportedCoin ? 'choose-name' : 'select-coin',
                    supportedCoins: coins,
                });
            })
            .catch(console.error);
    }

    private back = () => {
        switch (this.state.step) {
            case 'choose-name':
                this.setState({ step: 'select-coin' });
                break;
            case 'success':
                this.setState({ step: 'choose-name' });
                break;
        }
    }

    private next = (e: Event) => {
        e.preventDefault();
        const { accountName, coinCode, step } = this.state;
        switch (step) {
            case 'select-coin':
                this.setState({ step: 'choose-name' });
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
                        this.setState({ step: 'success' });
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
                // TODO: route to manage accounts to configure tokens
                route('/account-summary');
                return;
        }
    }

    private isFirstStep = () => {
        switch (this.state.step) {
            case 'select-coin':
                return true;
            case 'choose-name':
                return this.onlyOneSupportedCoin();
            case 'success':
                return false;
        }
    }

    private focusRef = (ref) => {
        setTimeout(() => {
            if (ref === document.activeElement) {
                return;
            }
            ref?.focus();
        }, 0);
    }

    private renderContent = () => {
        const { t } = this.props;
        const { accountName, coinCode, step, supportedCoins } = this.state;
        switch (step) {
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
                        autoFocus
                        getRef={this.focusRef}
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
                            className={styles.successMessage}
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
        const currentStep = [
            ...(!this.onlyOneSupportedCoin() ? ['select-coin'] : []),
            'choose-name',
            'success'
        ].indexOf(step);
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('manageAccounts.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content narrow isVerticallyCentered">
                        <form
                            className={`${styles.manageContainer} box large flex flex-column flex-between`}
                            onSubmit={this.next}>
                            <div className="text-center">
                                {t('manageAccounts.addAccount')}
                                <h1 class={styles.title}>{t(`manageAccounts.${step}.title`)}</h1>
                            </div>
                            <div class="row">
                                {this.renderContent()}
                            </div>
                            <div class="row">
                                <Steps current={currentStep}>
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
                                    disabled={this.isFirstStep()}
                                    transparent>
                                    {t('button.back')}
                                </Button>
                                <Button
                                    disabled={
                                        (step === 'select-coin' && coinCode === 'choose')
                                        || (step === 'choose-name' && accountName === '')
                                    }
                                    primary
                                    type="submit">
                                    {t(`manageAccounts.${step}.nextButton`)}
                                </Button>
                            </div>
                        </form>
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
