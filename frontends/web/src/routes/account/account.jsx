import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Button } from '../../components/forms';
import { Guide, Entry } from '../../components/guide/guide';
import Balance from '../../components/balance/balance';
import HeadersSync from '../../components/headerssync/headerssync';
import Status from '../../components/status/status';
import Send from './send/send';
import Receive from './receive/receive';
import Transactions from '../../components/transactions/transactions';
import Spinner from '../../components/spinner/Spinner';
import A from '../../components/anchor/anchor';
import componentStyle from '../../components/style.css';

@translate()
export default class Account extends Component {
    state = {
        accounts: [],
        walletInitialized: false,
        transactions: [],
        walletConnected: false,
        balance: null,
        hasCard: false,
        isReceive: false,
        isSend: false,
        isConfirming: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentDidMount() {
        apiGet('wallets').then(accounts => {
            this.setState({ accounts });
        });
        this.unsubscribe = apiWebsocket(this.onWalletEvent);
        if (!this.props.code) {
            return;
        }
        this.onStatusChanged();
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.code !== prevProps.code) {
            this.onStatusChanged();
            this.checkSDCards();
        }
        if (this.props.deviceIDs.length !== prevProps.deviceIDs.length) {
            this.checkSDCards();
        }
        if (!this.props.code) {
            if (this.state.accounts.length) {
                route(`/account/${this.state.accounts[0].code}`, true);
            }
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

    handleKeyDown = e => {
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.setState({
                isReceive: false,
                isSend: false,
            });
        }
    }

    onWalletEvent = data => {
        if (data.type !== 'wallet' || data.code !== this.props.code) {
            return;
        }
        switch (data.data) {
        case 'statusChanged':
            this.onStatusChanged();
            break;
        case 'syncdone':
            this.onWalletChanged();
            break;
        }
    }

    onStatusChanged = () => {
        apiGet(`wallet/${this.props.code}/status`).then(status => {
            console.log('Status changed: ' + status); // eslint-disable-line no-console
            let state = {
                walletInitialized: false,
                walletConnected: !status.includes('offlineMode'),
                isReceive: false,
                isSend: false
            };
            if (status.includes('accountSynced')) {
                state.walletInitialized = true;
            } else if (status.includes('keystoreAvailable')) {
                apiPost(`wallet/${this.props.code}/init`);
            }

            this.setState(state);
            this.onWalletChanged();
        });
    }

    onWalletChanged = () => {
        if (this.state.walletInitialized && this.state.walletConnected) {
            apiGet(`wallet/${this.props.code}/balance`).then(balance => {
                this.setState({ balance });
            });
            apiGet(`wallet/${this.props.code}/transactions`).then(transactions => {
                this.setState({ transactions });
            });
        } else {
            this.setState({ balance: null });
            this.setState({ transactions: [] });
        }
    }

    render({
        t,
        deviceIDs,
        guide,
        fiat,
    }, {
        accounts,
        walletInitialized,
        transactions,
        walletConnected,
        balance,
        hasCard,
        isReceive,
        isSend,
        isConfirming,
    }) {
        const wallet = accounts.find(({ code }) => code === this.props.code);
        if (!wallet) return null;

        if (!isReceive && !isSend) {
            const noTransactions = (walletInitialized && transactions.length <= 0);
            return (
                <div class="contentWithGuide">
                    <div class="container">
                        <div class="headerContainer">
                            <Status type="warning">
                                {hasCard && t('warning.sdcard')}
                            </Status>
                            <div class="header">
                                <Balance t={t} name={wallet.name} balance={balance} fiat={fiat} />
                                <div class={componentStyle.buttons} style="align-self: flex-end;">
                                    <Button primary disabled={!walletInitialized} onClick={() => this.setState({ isReceive: true })}>
                                        {t('button.receive')}
                                    </Button>
                                    <Button primary disabled={!walletInitialized || balance && balance.available === '0'} onClick={() => this.setState({ isSend: true })}>
                                        {t('button.send')}
                                    </Button>
                                </div>
                            </div>
                            <div>
                                {
                                    !walletConnected && (
                                        <Status>
                                            <p>{t('account.disconnect')}</p>
                                        </Status>
                                    )
                                }
                            </div>
                        </div>
                        <div class={['innerContainer', ''].join(' ')}
                            style>
                            <HeadersSync coinCode={wallet.coinCode} />
                            {
                                !walletInitialized || !walletConnected ? (
                                    <Spinner text={
                                        !walletInitialized && t('account.initializing') ||
                                        !walletConnected && t('account.reconnecting')
                                    } />
                                ) : (
                                    <Transactions
                                        explorerURL={wallet.blockExplorerTxPrefix}
                                        transactions={transactions}
                                        className={noTransactions ? 'isVerticallyCentered' : 'scrollableContainer'}
                                        fiat={fiat}
                                    />
                                )
                            }
                            <Status dismissable keyName={`info-${this.props.code}`} type="info">
                                {t(`account.info.${this.props.code}`)}
                            </Status>
                        </div>
                    </div>
                    <Guide guide={guide} screen="account">
                        {noTransactions && balance && <Entry title={t('guide.accountEmpty.title')}>
                            <p>{t('guide.accountEmpty.text', { unit: balance.available.unit })}</p>
                        </Entry>}
                        {balance && <Entry title={t('guide.accountReceive.title', { unit: balance.available.unit })}>
                            <p>{t('guide.accountReceive.text')}</p>
                        </Entry>}
                        {balance && balance.available === '0' && <Entry title={t('guide.accountSendDisabled.title', { unit: balance.available.unit })}>
                            <p>{t('guide.accountSendDisabled.text')}</p>
                        </Entry>}
                        <Entry title={t('guide.accountFiat.title', { fiat: fiat.code })}>
                            <p>{t('guide.accountFiat.text')}</p>
                        </Entry>
                        <Entry title={t('guide.accountRates.title')}>
                            <p>{t('guide.accountRates.text')}</p>
                            <p><A href={t('guide.accountRates.link.url')}>{t('guide.accountRates.link.text')}</A></p>
                        </Entry>
                        <Entry title={t('guide.accountReload.title')}>
                            <p>{t('guide.accountReload.text')}</p>
                        </Entry>
                        {transactions.length > 0 && <Entry title={t('guide.accountTransactionLabel.title')}>
                            <p>{t('guide.accountTransactionLabel.text')}</p>
                        </Entry>}
                        {transactions.length > 0 && <Entry title={t('guide.accountTransactionTime.title')}>
                            <p>{t('guide.accountTransactionTime.text')}</p>
                        </Entry>}
                        {transactions.length > 0 && <Entry title={t('guide.accountTransactionDetails.title')}>
                            <p>{t('guide.accountTransactionDetails.text')}</p>
                        </Entry>}
                        {transactions.length > 0 && <Entry title={t('guide.accountTransactionAttributes.title')}>
                            {t('guide.accountTransactionAttributes.text').map(p => <p>{p}</p>)}
                        </Entry>}
                        {balance && balance.hasIncoming && <Entry title={t('guide.accountIncomingBalance.title')}>
                            <p>{t('guide.accountIncomingBalance.text')}</p>
                        </Entry>}
                        <Entry title={t('guide.accountTransactionConfirmation.title')}>
                            <p>{t('guide.accountTransactionConfirmation.text')}</p>
                        </Entry>
                    </Guide>
                </div>
            );
        } else if (isReceive) {
            return (
                <Receive
                    deviceIDs={deviceIDs}
                    code={this.props.code}
                    onClose={() => this.setState({ isReceive: false })}
                    guide={guide}
                />
            );
        } else if (isSend) {
            return (
                <Send
                    deviceIDs={deviceIDs}
                    isConfirming={isConfirming}
                    setConfirmation={state => this.setState(state)}
                    wallet={wallet}
                    walletCode={wallet.code}
                    walletInitialized={walletInitialized}
                    balance={balance}
                    unit={balance.available.unit}
                    onClose={() => this.setState({ isSend: false })}
                    guide={guide}
                    fiat={fiat}
                />
            );
        }
    }
}
