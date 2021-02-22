/**
 * Copyright 2018 Shift Devices AG
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
import * as accountApi from '../../api/account';
import { syncAddressesCount } from '../../api/accountsync';
import { unsubscribe, UnsubscribeList } from '../../utils/subscriptions';
import { statusChanged, syncdone } from '../../api/subscribe-legacy';
import { Balance } from '../../components/balance/balance';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { HeadersSync } from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import { Transactions } from '../../components/transactions/transactions';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet } from '../../utils/request';
import { Devices } from '../device/deviceswitch';
import * as style from './account.css';
import { isBitcoinBased } from './utils';

interface AccountProps {
    code: string;
    devices: Devices;
    accounts: accountApi.IAccount[];
}

interface LoadedAccountProps {
    moonpayBuySupported: boolean;
    config: any;
}

interface State {
    accountSynced: boolean;
    offlineMode?: boolean;
    transactions?: accountApi.ITransaction[];
    balance?: accountApi.IBalance;
    hasCard: boolean;
    exported: string;
    accountInfo?:accountApi. ISigningConfigurationList;
    fatalError: boolean;
    syncedAddressesCount?: number;
}

type Props = LoadedAccountProps & AccountProps & TranslateProps;

class Account extends Component<Props, State> {
    public readonly state: State = {
        accountSynced: false,
        offlineMode: undefined,
        transactions: undefined,
        balance: undefined,
        hasCard: false,
        exported: '',
        accountInfo: undefined,
        fatalError: false,
        syncedAddressesCount: undefined,
    };

    private subscribtions: UnsubscribeList = [];

    public componentDidMount() {
        this.checkSDCards();
        if (!this.props.code) {
            return;
        }
        this.subscribe();
        this.onStatusChanged();
    }

    public componentWillUnmount() {
        unsubscribe(this.subscribtions);
    }

    public componentWillReceiveProps(nextProps) {
        if (nextProps.code && nextProps.code !== this.props.code) {
            this.setState({
                balance: undefined,
                transactions: undefined,
            });
            unsubscribe(this.subscribtions);
            this.subscribe();
        }
    }

    public componentDidUpdate(prevProps) {
        if (!this.props.code) {
            return;
        }
        if (this.props.code !== prevProps.code) {
            this.onStatusChanged();
            this.checkSDCards();
        }
        if (this.deviceIDs(this.props.devices).length !== this.deviceIDs(prevProps.devices).length) {
            this.checkSDCards();
        }
    }

    private subscribe() {
        this.subscribtions.push(
            syncAddressesCount(this.props.code, (code, syncedAddressesCount) => {
                if (code === this.props.code) {
                    this.setState({ syncedAddressesCount });
                }
            }),
            statusChanged(this.props.code, this.onStatusChanged),
            syncdone(this.props.code, this.onAccountChanged),
        );
    }

    private checkSDCards() {
        Promise.all(this.deviceIDs(this.props.devices).map(deviceID => {
            switch (this.props.devices[deviceID]) {
                case 'bitbox':
                    return apiGet(`devices/${deviceID}/info`)
                        .then(info => {
                            if (!info) {
                                return false;
                            }
                            return info.sdcard;
                        });
                case 'bitbox02':
                    return apiGet(`devices/bitbox02/${deviceID}/check-sdcard`)
                        .then(sdcard => sdcard);
                default:
                    return;
            }
        }))
            .then(sdcards => sdcards.some(sdcard => sdcard))
            .then(hasCard => this.setState({ hasCard }))
            .catch(console.error);
    }

    private onStatusChanged() {
        const code = this.props.code;
        if (!code) {
            return;
        }
        accountApi.getStatus(code).then(status => {
            if (this.props.code !== code) {
                // Results came in after the account was switched. Ignore.
                return;
            }
            const state = {
                accountSynced: status.includes('accountSynced'),
                offlineMode: status.includes('offlineMode'),
                fatalError: status.includes('fatalError'),
            };
            if (!status.includes('accountDisabled')) {
                if (!state.accountSynced) {
                    accountApi.init(code).catch(console.error);
                }
                if (state.accountSynced) {
                    accountApi.getInfo(code).then(accountInfo => {
                        if (this.props.code !== code) {
                            // Results came in after the account was switched. Ignore.
                            return;
                        }
                        this.setState({ accountInfo });
                    })
                    .catch(console.error);
                }
            }
            this.setState(state, this.onAccountChanged);
        })
        .catch(console.error);
    }

    private onAccountChanged = () => {
        if (!this.props.code || this.state.fatalError) {
            return;
        }
        if (this.state.accountSynced && !this.state.offlineMode) {
            const expectedCode = this.props.code;
            Promise.all([
                accountApi.getBalance(this.props.code).then(balance => {
                    if (this.props.code !== expectedCode) {
                        // Results came in after the account was switched. Ignore.
                        return;
                    }
                    this.setState({ balance });
                }),
                accountApi.getTransactionList(this.props.code).then(transactions => {
                    if (this.props.code !== expectedCode) {
                        // Results came in after the account was switched. Ignore.
                        return;
                    }
                    this.setState({ transactions });
                })
            ])
            .catch(console.error);
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
        accountApi.exportAccount(this.props.code)
            .then(exported => this.setState({ exported }))
            .catch(console.error);
    }

    private isBTCScriptType = (
        scriptType: accountApi.ScriptType,
        account: accountApi.IAccount,
        accountInfo?: accountApi.ISigningConfigurationList,
    ): boolean => {
        if (!accountInfo || accountInfo.signingConfigurations.length !== 1) {
            return false;
        }
        return (account.coinCode === 'btc' || account.coinCode === 'tbtc') &&
            accountInfo.signingConfigurations[0].scriptType === scriptType;
    }

    private deviceIDs = (devices: Devices) => {
        return Object.keys(devices);
    }

    private dataLoaded = () => {
        return this.state.balance !== undefined && this.state.transactions !== undefined;
    }

    private supportsBuy = () => {
        // True if at least one external service supports onramp for this account.
        return this.props.moonpayBuySupported;
    }

    public render(
        {
            t,
            code,
            accounts,
        }: RenderableProps<Props>,
        {
            transactions,
            accountSynced,
            offlineMode,
            balance,
            hasCard,
            exported,
            accountInfo,
            fatalError,
            syncedAddressesCount,
        }: State) {
        const account = accounts &&
                        accounts.find(acct => acct.code === code);
        if (!account) {
            return null;
        }
        const canSend = balance && balance.available.amount !== '0';

        const initializingSpinnerText =
            (syncedAddressesCount !== undefined && syncedAddressesCount > 1) ? (
                '\n' + t('account.syncedAddressesCount', {
                    count: syncedAddressesCount.toString(),
                    defaultValue: 0,
                })
            ) : null;

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning">
                        {hasCard && t('warning.sdcard')}
                    </Status>
                    { offlineMode ? (
                        <Status>
                            <p>{t('account.reconnecting')}</p>
                        </Status>
                    ) : null }
                    <Header
                        title={<h2><span>{account.name}</span></h2>}>
                        {isBitcoinBased(account.coinCode) ? (
                            <a href={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={style.accountIcon}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12" y2="8"></line>
                                </svg>
                                <span>{t('accountInfo.label')}</span>
                            </a>
                        ) : null}
                    </Header>
                    {accountSynced && this.dataLoaded() && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} />}
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <Status dismissable={`info-${code}`} type="info" className="m-bottom-default">
                                {t(`account.info.${code}`, { defaultValue: '' })}
                            </Status>
                            <div class="flex flex-row flex-between flex-items-center flex-column-mobile flex-reverse-mobile">
                                <label className="labelXLarge flex-self-start-mobile">{t('accountSummary.availableBalance')}</label>
                                <div className={style.actionsContainer}>
                                    {canSend ? (
                                        <a href={`/account/${code}/send`} className={style.send}><span>{t('button.send')}</span></a>
                                    ) : (
                                        <span className={`${style.send} ${style.disabled}`}>{t('button.send')}</span>
                                    )}
                                    <a href={`/account/${code}/receive`} className={style.receive}><span>{t('button.receive')}</span></a>
                                    { this.supportsBuy() && (
                                        <a href={`/buy/info/${code}`} className={style.buy}><span>{t('button.buy')}</span></a>
                                    )}
                                </div>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                !accountSynced || offlineMode || !this.dataLoaded() || fatalError ? (
                                    <Spinner text={
                                        fatalError && t('account.fatalError') ||
                                        offlineMode && t('account.reconnecting') ||
                                        !accountSynced && (
                                            t('account.initializing')
                                            + initializingSpinnerText
                                        ) || ''
                                    } />
                                ) : (
                                    <Transactions
                                        accountCode={code}
                                        exported={exported}
                                        handleExport={this.export}
                                        explorerURL={account.blockExplorerTxPrefix}
                                        transactions={transactions}
                                    />
                                )
                            }
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="accountDescription" entry={t('guide.accountDescription')} />
                    {this.isBTCScriptType('p2pkh', account, accountInfo) && (
                        <Entry key="guide.settings.btc-p2pkh" entry={t('guide.settings.btc-p2pkh')} />
                    )}
                    {this.isBTCScriptType('p2wpkh-p2sh', account, accountInfo) && (
                        <Entry key="guide.settings.btc-p2sh" entry={t('guide.settings.btc-p2sh')} />
                    )}
                    {this.isBTCScriptType('p2wpkh', account, accountInfo) && (
                    <Entry key="guide.settings.btc-p2wpkh" entry={t('guide.settings.btc-p2wpkh')} />
                    )}
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
                    {this.isBTCScriptType('p2pkh', account, accountInfo) && (
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
                    { /* careful, also used in Settings */ }
                    <Entry key="accountRates" entry={t('guide.accountRates')} />
                </Guide>
            </div>
        );
    }
}

const loadHOC = load<LoadedAccountProps, AccountProps & TranslateProps>(({ code }) => ({
    moonpayBuySupported: `exchange/moonpay/buy-supported/${code}`,
    config: 'config',
}))(Account);

const HOC = translate<AccountProps>()(loadHOC);
export { HOC as Account };
