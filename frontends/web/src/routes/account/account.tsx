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
import ArrowDown from '../../assets/icons/arrow-down.svg';
import ArrowUp from '../../assets/icons/arrow-up.svg';
import checkIcon from '../../assets/icons/check.svg';
import exportIcon from '../../assets/icons/download.svg';
import A from '../../components/anchor/anchor';
import { Balance, BalanceInterface } from '../../components/balance/balance';
import { ButtonLink } from '../../components/forms';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import HeadersSync from '../../components/headerssync/headerssync';
import { Header } from '../../components/layout';
import Spinner from '../../components/spinner/Spinner';
import Status from '../../components/status/status';
import * as componentStyle from '../../components/style.css';
import Transactions from '../../components/transactions/transactions';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Devices } from '../device/deviceswitch';
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
    determiningStatus: boolean;
    initialized: boolean;
    connected: boolean;
    transactions: any[]; // define once transaction.jsx is converted
    balance?: BalanceInterface;
    hasCard: boolean;
    exported: string;
    accountInfo?: AccountInfo;
    fatalError: boolean;
}

type Props = AccountProps & TranslateProps;

class Account extends Component<Props, State> {
    public state = {
        // We update the account state in componentDidUpdate(), without resetting
        // the state, to avoid a rerender (screen flash). For a split second however, the state
        // is old/undefined (e.g. the new account might not be initialized, but state.initialized
        // is still true from a previous account until it is updated in onStatusChanged()).
        // determiningStatus indicates this situation and is true during that time.
        determiningStatus: false,
        initialized: false,
        connected: false,
        transactions: [],
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
            this.setState({ determiningStatus: true });
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
            const state = {
                initialized: status.includes('accountSynced'),
                connected: !status.includes('offlineMode'),
                fatalError: status.includes('fatalError'),
                determiningStatus: false,
            };
            if (!state.initialized && !status.includes('accountDisabled')) {
                apiPost(`account/${code}/init`);
            }
            if (state.initialized && !status.includes('accountDisabled')) {
                apiGet(`account/${code}/info`).then(accountInfo => {
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
            apiGet(`account/${this.props.code}/balance`).then(balance => {
                this.setState({ balance });
            });
            apiGet(`account/${this.props.code}/transactions`).then(transactions => {
                this.setState({ transactions });
            });
        } else {
            this.setState({ balance: undefined });
            this.setState({ transactions: [] });
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
            determiningStatus,
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
        const noTransactions = (initialized && transactions.length <= 0);
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
                        title={
                            <h2 className={componentStyle.title}>
                                <span>{account.name}</span>
                                    <a href={`/account/${code}/info`} className={componentStyle.infoButton} title={t('accountInfo.title')}>i</a>
                                {
                                    exported ? (
                                        <A href={exported} title={exported} className="flex flex-row flex-start flex-items-center">
                                            <span className={componentStyle.exportedButton} style="margin-right: 5px;">
                                                <img src={checkIcon} style="margin-right: 5px !important;" />
                                                <span className={componentStyle.exportedText}>{t('account.openFile')}</span>
                                            </span>
                                        </A>
                                    ) : (
                                            <a onClick={this.export} className={componentStyle.exportButton} title={t('account.exportTransactions')}>
                                                <img src={exportIcon} />
                                            </a>
                                        )
                                }
                            </h2>
                        }>
                        <Balance balance={balance} />
                        <div class={componentStyle.buttons}>
                            <ButtonLink
                                primary
                                href={`/account/${code}/receive`}
                                disabled={!initialized}>
                                <img src={ArrowDown} />
                                <span>{t('button.receive')}</span>
                            </ButtonLink>
                            <ButtonLink
                                primary
                                href={`/account/${code}/send`}
                                disabled={!initialized || balance && balance.available.amount === '0'}>
                                <img src={ArrowUp} />
                                <span>{t('button.send')}</span>
                            </ButtonLink>
                        </div>
                    </Header>
                    <div class={['innerContainer', ''].join(' ')}>
                        {initialized && !determiningStatus && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} />}
                        {
                            !initialized || !connected || fatalError ? (
                                <Spinner text={
                                    !connected && t('account.reconnecting') ||
                                    !initialized && t('account.initializing') ||
                                    fatalError && t('account.fatalError')
                                } />
                            ) : (
                                    <Transactions
                                        explorerURL={account.blockExplorerTxPrefix}
                                        transactions={transactions}
                                        className={noTransactions ? 'isVerticallyCentered' : 'scrollableContainer'}
                                    />
                                )
                        }
                        <Status dismissable keyName={`info-${code}`} type="info">
                            {t(`account.info.${code}`, { defaultValue: '' })}
                        </Status>
                    </div>
                </div>
                <Guide>
                    <Entry key="accountDescription" entry={t('guide.accountDescription')} />
                    {balance && balance.available.amount === '0' && (
                        <Entry key="accountSendDisabled" entry={t('guide.accountSendDisabled', { unit: balance.available.unit })} />
                    )}
                    <Entry key="accountReload" entry={t('guide.accountReload')} />
                    {transactions.length > 0 && (
                        <Entry key="accountTransactionLabel" entry={t('guide.accountTransactionLabel')} />
                    )}
                    {transactions.length > 0 && (
                        <Entry key="accountTransactionTime" entry={t('guide.accountTransactionTime')} />
                    )}
                    {this.isLegacy(account, accountInfo) && (
                        <Entry key="accountLegacyConvert" entry={t('guide.accountLegacyConvert')} />
                    )}
                    {transactions.length > 0 && (
                        <Entry key="accountTransactionAttributesGeneric" entry={t('guide.accountTransactionAttributesGeneric')} />
                    )}
                    {transactions.length > 0 && isBitcoinBased(account.coinCode) && (
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
