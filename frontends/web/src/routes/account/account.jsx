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

import { Component, h } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { ButtonLink } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import Header from '../../components/header/Header';
import Balance from '../../components/balance/balance';
import HeadersSync from '../../components/headerssync/headerssync';
import Status from '../../components/status/status';
import Transactions from '../../components/transactions/transactions';
import Spinner from '../../components/spinner/Spinner';
import InfoIcon from '../../assets/icons/info.svg';
import ArrowUp from '../../assets/icons/arrow-up.svg';
import ArrowDown from '../../assets/icons/arrow-down.svg';
import * as componentStyle from '../../components/style.css';
import { isBitcoinBased } from './utils';

@translate()
export default class Account extends Component {
    state = {
        // We update the account state in componentDidUpdate(), without resetting
        // the state, to avoid a rerender (screen flash). For a split second however, the state
        // is old/undefined (e.g. the new account might not be initialized, but state.initialized
        // is still true from a previous account until it is updated in onStatusChanged()).
        // determiningStatus indicates this situation and is true during that time.
        determiningStatus: false,
        initialized: false,
        connected: false,
        transactions: [],
        balance: null,
        hasCard: false,
    }

    componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onEvent);
        this.checkSDCards();
        if (!this.props.code) {
            return;
        }
        this.onStatusChanged();
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.code && nextProps.code !== this.props.code) {
            this.setState({ determiningStatus: true });
        }
    }

    componentDidUpdate(prevProps) {
        if (!this.props.code) {
            if (this.props.accounts && this.props.accounts.length) {
                console.log('route', `/account/${this.props.accounts[0].code}`); // eslint-disable-line no-console
                route(`/account/${this.props.accounts[0].code}`, true);
            }
            return;
        }
        if (this.props.code !== prevProps.code) {
            this.onStatusChanged();
        }
        if (this.props.deviceIDs.length !== prevProps.deviceIDs.length) {
            this.checkSDCards();
        }
    }

    checkSDCards() {
        Promise.all(this.props.deviceIDs.map(deviceID => {
            return apiGet(`devices/${deviceID}/info`)
                .then(({ sdcard }) => sdcard);
        }))
            .then(sdcards => sdcards.some(sdcard => sdcard))
            .then(hasCard => this.setState({ hasCard }));
    }

    onEvent = data => {
        if (!this.props.code) return;
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

    onStatusChanged() {
        const code = this.props.code;
        if (!code) return;
        apiGet(`account/${code}/status`).then(status => {
            let state = {
                initialized: status.includes('accountSynced'),
                connected: !status.includes('offlineMode'),
                determiningStatus: false,
            };
            if (!status.initialized && !status.includes('accountDisabled')) {
                apiPost(`account/${code}/init`);
            }

            this.setState(state);
            this.onAccountChanged();
        });
    }

    onAccountChanged = () => {
        if (!this.props.code) return;
        if (this.state.initialized && this.state.connected) {
            apiGet(`account/${this.props.code}/balance`).then(balance => {
                this.setState({ balance });
            });
            apiGet(`account/${this.props.code}/transactions`).then(transactions => {
                this.setState({ transactions });
            });
        } else {
            this.setState({ balance: null });
            this.setState({ transactions: [] });
        }
    }

    render({
        t,
        code,
        accounts,
    }, {
        transactions,
        initialized,
        connected,
        determiningStatus,
        balance,
        hasCard,
    }) {
        if (!accounts) return null;
        const account = accounts.find(account => account.code === code);
        if (!account) return null;
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
                                {account.name}
                                { isBitcoinBased(account.coinCode) ? <a href={`/account/${code}/info`}><img src={InfoIcon} /></a> : '' }
                            </h2>
                        }
                        {...this.props}>
                        <Balance
                            t={t}
                            balance={balance} />
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
                        { initialized && !determiningStatus && isBitcoinBased(account.coinCode) && <HeadersSync coinCode={account.coinCode} /> }
                        {
                            !initialized || !connected ? (
                                <Spinner text={
                                    !connected && t('account.reconnecting') ||
                                    !initialized && t('account.initializing')
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
                    {(account.code === 'tbtc-p2pkh' || account.code === 'btc-p2pkh') && (
                        <Entry key="accountLegacyConvert" entry={t('guide.accountLegacyConvert')} />
                    )}
                    {transactions.length > 0 && (
                        <Entry key="accountTransactionAttributes" entry={t('guide.accountTransactionAttributes')} />
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
