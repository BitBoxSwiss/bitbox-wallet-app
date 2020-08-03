/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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
import { Balance, BalanceInterface } from '../../components/balance/balance';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import HeadersSync from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import { TransactionInterface } from '../../components/transactions/transaction';
import { Transactions } from '../../components/transactions/transactions';
import { load } from '../../decorators/load';
import { subscribe } from '../../decorators/subscribe';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Devices } from '../device/deviceswitch';
import * as style from './account.css';
import { ScriptType, SigningConfigurationInterface } from './info/signingconfiguration';
import { isBitcoinBased } from './utils';

export type CoinCode = 'btc' | 'tbtc' | 'ltc' | 'tltc' | 'eth' | 'teth' | 'reth';

export interface AccountInterface {
    coinCode: CoinCode;
    coinUnit: string;
    code: string;
    name: string;
    blockExplorerTxPrefix: string;
}

interface AccountProps {
    code: string;
    devices: Devices;
    accounts: AccountInterface[];
}

interface LoadedAccountProps {
    safelloBuySupported: boolean;
    config: any;
}

interface SubscribedAccountProps {
    syncedAddressesCount?: number;
}

export interface AccountInfo {
    signingConfigurations: SigningConfigurationInterface[];
}

interface State {
    initialized: boolean;
    connected: boolean;
    transactions?: TransactionInterface[];
    balance?: BalanceInterface;
    hasCard: boolean;
    exported: string;
    accountInfo?: AccountInfo;
    fatalError: boolean;
}

type Props = SubscribedAccountProps & LoadedAccountProps & AccountProps & TranslateProps;

class Account extends Component<Props, State> {
    public readonly state: State = {
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

    private isBTCScriptType = (scriptType: ScriptType, account: AccountInterface, accountInfo?: AccountInfo): boolean => {
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
        // True if both the backend supports it for this account, as well as the app settings enable it.
        return this.props.safelloBuySupported && this.props.config.backend.services.safello;
    }

    public render(
        {
            t,
            code,
            accounts,
            syncedAddressesCount,
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
        const canSend = balance && balance.available.amount !== '0';

        let initializingSpinnerText = t('account.initializing');
        if (syncedAddressesCount !== undefined && syncedAddressesCount > 1) {
            initializingSpinnerText += '\n' + t('account.syncedAddressesCount', {
                count: syncedAddressesCount,
                defaultValue: 0,
            });
        }

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
                        <a href={`/account/${code}/info`} title={t('accountInfo.title')} className="flex flex-row flex-items-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                className={style.accountIcon}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12" y2="8"></line>
                            </svg>
                            <span>{t('accountInfo.label')}</span>
                        </a>
                    </Header>
                    {initialized && this.dataLoaded() && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} />}
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <Status dismissable keyName={`info-${code}`} type="info" className="m-bottom-default">
                                {t(`account.info.${code}`, { defaultValue: '' })}
                            </Status>
                            <div class="flex flex-row flex-between flex-items-center">
                                <label className="labelXLarge">{t('accountSummary.availableBalance')}</label>
                                <div className={style.actionsContainer}>
                                    { this.supportsBuy() && (
                                          <a href={`/account/${code}/buy`} className={style.buy}><span>{t('button.buy')}</span></a>
                                    )
                                    }
                                    {
                                        canSend ? (
                                            <a href={`/account/${code}/send`} className={style.send}><span>{t('button.send')}</span></a>
                                        ) : (
                                            <a className={[style.send, style.disabled].join(' ')}><span>{t('button.send')}</span></a>
                                        )
                                    }
                                    <a href={`/account/${code}/receive`} className={style.receive}><span>{t('button.receive')}</span></a>
                                </div>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                !initialized || !connected || !this.dataLoaded() || fatalError ? (
                                    <Spinner text={
                                        !connected && t('account.reconnecting') ||
                                        !initialized && initializingSpinnerText ||
                                        fatalError && t('account.fatalError') || ''
                                    } />
                                ) : (
                                    <Transactions
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

const loadHOC = load<LoadedAccountProps, SubscribedAccountProps & AccountProps & TranslateProps>(({ code }) => ({
    safelloBuySupported: `account/${code}/exchange/safello/buy-supported`,
    config: 'config',
}))(Account);

const subscribeHOC = subscribe<SubscribedAccountProps, AccountProps & TranslateProps>(({ code }) => ({
    syncedAddressesCount: `account/${code}/synced-addresses-count`,
}), false, true)(loadHOC);

const HOC = translate<AccountProps>()(subscribeHOC);
export { HOC as Account };
