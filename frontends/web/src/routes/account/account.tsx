/**
 * Copyright 2018 Shift Devices AG
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
import { Balance, BalanceInterface } from '../../components/balance/balance';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import HeadersSync from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import Spinner from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import Transactions from '../../components/transactions/transactions';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Devices } from '../device/deviceswitch';
import * as style from './account.css';
import { SigningConfigurationInterface } from './info/signingconfiguration';
import { isBitcoinBased } from './utils';

export interface AccountInterface {
    coinCode: 'btc' | 'tbtc' | 'ltc' | 'tltc' | 'eth' | 'teth' | 'reth';
    code: string;
    name: string;
    blockExplorerTxPrefix: string;
}

interface AccountProps {
    code: string;
    devices: Devices;
    accounts: AccountInterface[];
}

export interface AccountInfo {
    signingConfiguration: SigningConfigurationInterface;
}

interface State {
    initialized: boolean;
    connected: boolean;
    transactions?: any[]; // define once transaction.jsx is converted
    balance?: BalanceInterface;
    hasCard: boolean;
    exported: string;
    accountInfo?: AccountInfo;
    fatalError: boolean;
}

type Props = AccountProps & TranslateProps;

class Account extends Component<Props, State> {
    public state = {
        initialized: false,
        connected: false,
        transactions: undefined,
        balance: undefined,
        hasCard: false,
        exported: '',
        accountInfo: undefined,
        fatalError: false,
    };

    private unsubscribe!: () => void;

    public componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onEvent);
        this.checkSDCards();
        if (!this.props.code) {
            return;
        }
        this.onStatusChanged();
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    public componentWillReceiveProps(nextProps) {
        if (nextProps.code && nextProps.code !== this.props.code) {
            this.setState({
                balance: undefined,
                transactions: undefined,
            });
        }
    }

    public componentDidUpdate(prevProps) {
        if (!this.props.code) {
            if (this.props.accounts && this.props.accounts.length) {
                route(`/account/${this.props.accounts[0].code}`, true);
            }
            return;
        }
        if (this.props.code !== prevProps.code) {
            this.onStatusChanged();
        }
        if (this.deviceIDs(this.props.devices).length !== this.deviceIDs(prevProps.devices).length) {
            this.checkSDCards();
        }
    }

    private checkSDCards() {
        Promise.all(this.deviceIDs(this.props.devices).map(deviceID => {
            let apiPrefix;
            switch (this.props.devices[deviceID]) {
            case 'bitbox':
                apiPrefix = 'devices/';
                break;
            case 'bitbox02':
                apiPrefix = 'devices/bitbox02/';
                break;
            default:
                return;
            }
            return apiGet(`${apiPrefix}${deviceID}/info`)
                .then(info => {
                    if (!info) {
                        return false;
                    }
                    return info.sdcard;
                });
        }))
            .then(sdcards => sdcards.some(sdcard => sdcard))
            .then(hasCard => this.setState({ hasCard }));
    }

    private onEvent = data => {
        if (!this.props.code) {
            return;
        }
        if (data.type !== 'account' || data.code !== this.props.code) {
            return;
        }
        switch (data.data) {
            case 'statusChanged':
                this.onStatusChanged();
                break;
            case 'syncdone':
                this.onAccountChanged();
                break;
        }
    }

    private onStatusChanged() {
        const code = this.props.code;
        if (!code) {
            return;
        }
        apiGet(`account/${code}/status`).then(status => {
            if (this.props.code !== code) {
                // Results came in after the account was switched. Ignore.
                return;
            }
            const state = {
                initialized: status.includes('accountSynced'),
                connected: !status.includes('offlineMode'),
                fatalError: status.includes('fatalError'),
            };
            if (!state.initialized && !status.includes('accountDisabled')) {
                apiPost(`account/${code}/init`);
            }
            if (state.initialized && !status.includes('accountDisabled')) {
                apiGet(`account/${code}/info`).then(accountInfo => {
                    if (this.props.code !== code) {
                        // Results came in after the account was switched. Ignore.
                        return;
                    }
                    this.setState({ accountInfo });
                });
            }

            this.setState(state);
            this.onAccountChanged();
        });
    }

    private onAccountChanged = () => {
        if (!this.props.code || this.state.fatalError) {
            return;
        }
        if (this.state.initialized && this.state.connected) {
            const expectedCode = this.props.code;
            apiGet(`account/${this.props.code}/balance`).then(balance => {
                if (this.props.code !== expectedCode) {
                    // Results came in after the account was switched. Ignore.
                    return;
                }
                this.setState({ balance });
            });
            apiGet(`account/${this.props.code}/transactions`).then(transactions => {
                if (this.props.code !== expectedCode) {
                    // Results came in after the account was switched. Ignore.
                    return;
                }
                this.setState({ transactions });
            });
        } else {
            this.setState({
                balance: undefined,
                transactions: undefined,
            });
        }
        this.setState({ exported: '' });
    }

    private export = () => {
        if (this.state.fatalError) {
            return;
        }
        apiPost(`account/${this.props.code}/export`).then(exported => {
            this.setState({ exported });
        });
    }

    private isLegacy = (account: AccountInterface, accountInfo?: AccountInfo): boolean => {
        if (!accountInfo) {
            return false;
        }
        return (account.coinCode === 'btc' || account.coinCode === 'tbtc') &&
            accountInfo.signingConfiguration.scriptType === 'p2pkh';
    }

    private deviceIDs = (devices: Devices) => {
        return Object.keys(devices);
    }

    private dataLoaded = () => {
        return this.state.balance !== undefined && this.state.transactions !== undefined;
    }

    public render(
        {
            t,
            code,
            accounts,
        }: RenderableProps<Props>,
        {
            transactions,
            initialized,
            connected,
            balance,
            hasCard,
            exported,
            accountInfo,
            fatalError,
        }: State) {
        const account = accounts &&
                        accounts.find(acct => acct.code === code);
        if (!account) {
            return null;
        }
        const noTransactions = (initialized && transactions !== undefined && transactions.length <= 0);
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning">
                        {hasCard && t('warning.sdcard')}
                    </Status>
                    {
                        !connected ? (
                            <Status>
                                <p>{t('account.disconnect')}</p>
                            </Status>
                        ) : null
                    }
                    <Header
                        title={<h2><span>{account.name}</span></h2>}>
                        <a href={`/account/${code}/info`} title={t('accountInfo.title')}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12" y2="8"></line>
                            </svg>
                        </a>
                    </Header>
                    {initialized && this.dataLoaded() && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} />}
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <Status dismissable keyName={`info-${code}`} type="info" className="m-bottom-default">
                                {t(`account.info.${code}`, { defaultValue: '' })}
                            </Status>
                            <div class="flex flex-row flex-between flex-items-center">
                                <label className="labelLarge">Available Balance</label>
                                <div className={style.actions}>
                                    <a href={`/account/${code}/send`} className={['labelLarge labelLink', style.accountLink, style.send].join(' ')}>
                                        <span>{t('button.send')}</span>
                                    </a>
                                    <span className={style.separator}>/</span>
                                    <a href={`/account/${code}/receive`} className={['labelLarge labelLink', style.accountLink, style.receive].join(' ')}>
                                        <span>{t('button.receive')}</span>
                                    </a>
                                </div>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                !initialized || !connected || !this.dataLoaded() || fatalError ? (
                                    <Spinner text={
                                        !connected && t('account.reconnecting') ||
                                        !initialized && t('account.initializing') ||
                                        fatalError && t('account.fatalError') || ''
                                    } />
                                ) : (
                                    <Transactions
                                        exported={exported}
                                        handleExport={this.export}
                                        explorerURL={account.blockExplorerTxPrefix}
                                        transactions={transactions}
                                        unit={balance!.available.unit}
                                        className={noTransactions ? 'isVerticallyCentered' : 'scrollableContainer'}
                                    />
                                )
                            }
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="accountDescription" entry={t('guide.accountDescription')} />
                    {balance && balance.available.amount === '0' && (
                        <Entry key="accountSendDisabled" entry={t('guide.accountSendDisabled', { unit: balance.available.unit })} />
                    )}
                    <Entry key="accountReload" entry={t('guide.accountReload')} />
                    {transactions !== undefined && transactions.length > 0 && (
                        <Entry key="accountTransactionLabel" entry={t('guide.accountTransactionLabel')} />
                    )}
                    {transactions !== undefined && transactions.length > 0 && (
                        <Entry key="accountTransactionTime" entry={t('guide.accountTransactionTime')} />
                    )}
                    {this.isLegacy(account, accountInfo) && (
                        <Entry key="accountLegacyConvert" entry={t('guide.accountLegacyConvert')} />
                    )}
                    {transactions !== undefined &&  transactions.length > 0 && (
                        <Entry key="accountTransactionAttributesGeneric" entry={t('guide.accountTransactionAttributesGeneric')} />
                    )}
                    {transactions !== undefined && transactions.length > 0 && isBitcoinBased(account.coinCode) && (
                        <Entry key="accountTransactionAttributesBTC" entry={t('guide.accountTransactionAttributesBTC')} />
                    )}
                    {balance && balance.hasIncoming && (
                        <Entry key="accountIncomingBalance" entry={t('guide.accountIncomingBalance')} />
                    )}
                    <Entry key="accountTransactionConfirmation" entry={t('guide.accountTransactionConfirmation')} />
                    <Entry key="accountFiat" entry={t('guide.accountFiat')} />
                    <Entry key="accountRates" entry={t('guide.accountRates')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<AccountProps>()(Account);
export { HOC as Account };
