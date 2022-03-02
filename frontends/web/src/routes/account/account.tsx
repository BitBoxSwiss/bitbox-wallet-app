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

import { Component} from 'react';
import * as accountApi from '../../api/account';
import { syncAddressesCount } from '../../api/accountsync';
import { TDevices } from '../../api/devices';
import { unsubscribe, UnsubscribeList } from '../../utils/subscriptions';
import { statusChanged, syncdone } from '../../api/subscribe-legacy';
import { alertUser } from '../../components/alert/Alert';
import { Balance } from '../../components/balance/balance';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { HeadersSync } from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import { Info } from '../../components/icon';
import { Spinner } from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import { Transactions } from '../../components/transactions/transactions';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet } from '../../utils/request';
import { BuyCTA } from './info/buyCTA';
import style from './account.module.css';
import { isBitcoinBased } from './utils';
import { Link } from 'react-router-dom';

// Show some additional info for the following coin types, if legacy split acocunts is enabled.
const WithCoinTypeInfo = [
    'btc-p2pkh',
    'btc-p2wpkh',
    'btc-p2wpkh-p2sh',
    'tbtc-p2pkh',
    'tbtc-p2wpkh',
    'tbtc-p2wpkh-p2sh',
];

interface AccountProps {
    code: string;
    devices: TDevices;
    accounts: accountApi.IAccount[];
}

interface LoadedAccountProps {
    moonpayBuySupported: boolean;
    config: any;
}

interface State {
    status?: accountApi.IStatus;
    transactions?: accountApi.ITransaction[];
    balance?: accountApi.IBalance;
    hasCard: boolean;
    accountInfo?: accountApi.ISigningConfigurationList;
    syncedAddressesCount?: number;
}

type Props = LoadedAccountProps & AccountProps & TranslateProps;

class Account extends Component<Props, State> {
    public readonly state: State = {
        status: undefined,
        transactions: undefined,
        balance: undefined,
        hasCard: false,
        accountInfo: undefined,
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

    public UNSAFE_componentWillReceiveProps(nextProps: Props) {
        if (nextProps.code && nextProps.code !== this.props.code) {
            this.setState({
                status: undefined,
                balance: undefined,
                syncedAddressesCount: 0,
                transactions: undefined,
            });
        }
    }

    public componentDidUpdate(prevProps: Props) {
        if (!this.props.code) {
            return;
        }
        if (this.props.code !== prevProps.code) {
            this.onStatusChanged();
            this.checkSDCards();
            unsubscribe(this.subscribtions);
            this.subscribe();
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
            statusChanged(this.props.code, () => this.onStatusChanged()),
            syncdone(this.props.code, () => this.onAccountChanged()),
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
                    return [];
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
            if (!status.disabled) {
                if (!status.synced) {
                    accountApi.init(code).catch(console.error);
                } else {
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
            this.setState({ status }, this.onAccountChanged);
        })
        .catch(console.error);
    }

    private onAccountChanged = () => {
        const status = this.state.status;
        if (!this.props.code || status === undefined || status.fatalError) {
            return;
        }
        if (status.synced && status.offlineError === null) {
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
    }

    private export = () => {
        if (this.state.status === undefined || this.state.status.fatalError) {
            return;
        }
        accountApi.exportAccount(this.props.code)
            .then(result => {
                if (result !== null && !result.success) {
                    alertUser(result.errorMessage);
                }
            })
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
        const config = accountInfo.signingConfigurations[0].bitcoinSimple;
        return (account.coinCode === 'btc' || account.coinCode === 'tbtc') &&
            config !== undefined && config.scriptType === scriptType;
    }

    private deviceIDs = (devices: TDevices) => {
        return Object.keys(devices);
    }

    private dataLoaded = () => {
        return this.state.balance !== undefined && this.state.transactions !== undefined;
    }

    private supportsBuy = () => {
        // True if at least one external service supports onramp for this account.
        return this.props.moonpayBuySupported;
    }

    public render() {
        const {
            t,
            code,
            accounts,
            config,
        } = this.props;
        const {
            status,
            transactions,
            balance,
            hasCard,
            accountInfo,
            syncedAddressesCount,
        } = this.state;
        const account = accounts &&
                        accounts.find(acct => acct.code === code);
        if (!account || status === undefined) {
            return null;
        }

        const canSend = balance && balance.available.amount !== '0';

        const initializingSpinnerText =
            (syncedAddressesCount !== undefined && syncedAddressesCount > 1) ? (
                '\n' + t('account.syncedAddressesCount', {
                    count: syncedAddressesCount.toString(),
                    defaultValue: 0,
                } as any)
            ) : '';

        const offlineErrorTextLines: string[] = [];
        if (status.offlineError !== null) {
            offlineErrorTextLines.push(t('account.reconnecting'));
            offlineErrorTextLines.push(status.offlineError);
            if (config.backend.proxy.useProxy) {
                offlineErrorTextLines.push(t('account.maybeProxyError'));
            }
        }

        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Status hidden={!hasCard} type="warning">
                        {t('warning.sdcard')}
                    </Status>
                    <Header
                        title={<h2><span>{account.name}</span></h2>}>
                        <Link to={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center">
                            <Info className={style.accountIcon} />
                            <span>{t('accountInfo.label')}</span>
                        </Link>
                    </Header>
                    {status.synced && this.dataLoaded() && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} />}
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            { this.supportsBuy() && balance && (balance.available.amount === '0') && <BuyCTA code={code} unit={balance.available.unit} /> }
                            <Status
                                className="m-bottom-default"
                                hidden={!WithCoinTypeInfo.includes(code)}
                                dismissable={`info-${code}`}
                                type="info">
                                {t(`account.info.${code}`)}
                            </Status>
                            <div className="flex flex-row flex-between flex-items-center flex-column-mobile flex-reverse-mobile">
                                <label className="labelXLarge flex-self-start-mobile">{t('accountSummary.availableBalance')}</label>
                                <div className={style.actionsContainer}>
                                    {canSend ? (
                                        <Link key="sendLink" to={`/account/${code}/send`} className={style.send}><span>{t('button.send')}</span></Link>
                                    ) : (
                                        <span key="sendDisabled" className={`${style.send} ${style.disabled}`}>{t('button.send')}</span>
                                    )}
                                    <Link key="receive" to={`/account/${code}/receive`} className={style.receive}><span>{t('button.receive')}</span></Link>
                                    { this.supportsBuy() && (
                                        <Link key="buy" to={`/buy/info/${code}`} className={style.buy}><span>{t('button.buy')}</span></Link>
                                    )}
                                </div>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                !status.synced || offlineErrorTextLines.length || !this.dataLoaded() || status.fatalError ? (
                                    <Spinner text={
                                        (status.fatalError && t('account.fatalError'))
                                        || offlineErrorTextLines.join('\n')
                                        || (!status.synced &&
                                            t('account.initializing')
                                            + initializingSpinnerText
                                        )
                                        || ''
                                    } />
                                ) : (
                                    <Transactions
                                        accountCode={code}
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

                    <Entry key="cointracking" entry={{
                        link: {
                            text: 'CoinTracking',
                            url: 'https://cointracking.info/import/bitbox/',
                        },
                        text: t('guide.cointracking.text'),
                        title: t('guide.cointracking.title')
                    }} />
                </Guide>
            </div>
        );
    }
}

const loadHOC = load<LoadedAccountProps, AccountProps & TranslateProps>(({ code }) => ({
    moonpayBuySupported: `exchange/moonpay/buy-supported/${code}`,
    config: 'config',
}))(Account);

const HOC = translate()(loadHOC);
export { HOC as Account };
