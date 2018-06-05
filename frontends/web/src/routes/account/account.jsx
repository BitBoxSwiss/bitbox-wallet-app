import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Button } from '../../components/forms';
import { Guide, Entry } from '../../components/guide/guide';
import Balance from '../../components/balance/balance';
import Status from '../../components/status/status';
import Send from './send/send';
import Receive from './receive/receive';
import Transactions from '../../components/transactions/transactions';
import Spinner from '../../components/spinner/Spinner';
import componentStyle from '../../components/style.css';
import style from './account.css';

@translate()
export default class Account extends Component {
    state = {
        accounts: [],
        walletInitialized: false,
        transactions: [],
        walletConnected: false,
        balance: null,
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
            console.log('componentDidUpdate(' + this.props.code + ')');
            this.onStatusChanged();
        }
        if (!this.props.code) {
            if (this.state.accounts.length) {
                route(`/account/${this.state.accounts[0].code}`, true);
            }
        }
    }

    handleKeyDown = e => {
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.setState({
                isReceive: false,
                isSend: false,
            });
        } else {
            return;
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
        console.log('Wallet ' + this.props.code + ' requesting status.');
        apiGet('wallet/' + this.props.code + '/status').then(status => {
            if (status === 'initialized') {
                this.setState({
                    walletInitialized: true,
                    walletConnected: true,
                    isReceive: false,
                    isSend: false,
                });
            } else if (status === 'connected') {
                this.setState({
                    walletInitialized: false,
                    walletConnected: true,
                });
                apiPost("wallet/" + this.props.code + "/init");
            } else {
                this.setState({
                    walletInitialized: false,
                    walletConnected: false,
                });
            }
            this.onWalletChanged();
        });
    }

    onWalletChanged = () => {
        if (this.state.walletInitialized && this.state.walletConnected) {
            console.log('Wallet ' + this.props.code + ' initialized.');
            apiGet('wallet/' + this.props.code + '/transactions').then(transactions => {
                this.setState({ transactions });
            });
            apiGet('wallet/' + this.props.code + '/balance').then(balance => {
                this.setState({ balance });
            });
        } else {
            console.log('Wallet ' + this.props.code + ' disconnected. Should rerender');
            this.setState({ balance: null });
        }
    }

    render({
        t,
        guide,
    }, {
        accounts,
        walletInitialized,
        transactions,
        walletConnected,
        balance,
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
                            <div class="header">
                                <Balance name={wallet.name} balance={balance}>
                                    {
                                        balance && balance.hasIncoming && (
                                            <h5 class={style.pendingBalance}>
                                                {balance.incoming}
                                                <span style="color: var(--color-light);">{balance.unit}</span>
                                                {' '}
                                                {t('account.incoming')}
                                            </h5>
                                        )
                                    }
                                </Balance>
                                <div class={componentStyle.buttons} style="align-self: flex-end;">
                                    <Button primary disabled={!walletInitialized} onClick={() => this.setState({ isReceive: true })}>
                                        {t('button.receive')}
                                    </Button>
                                    <Button primary disabled={!walletInitialized || balance && balance.available === '0'} onClick={() => this.setState({ isSend: true })}>
                                        {t('button.send')}
                                    </Button>
                                </div>
                            </div>
                            <Status dismissable keyName={`info-${this.props.code}`} type="info">
                                {t(`account.info.${this.props.code}`)}
                            </Status>
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
                        <div class={['innerContainer', 'scrollableContainer'].join(' ')}>
                            {
                                !walletInitialized ? (
                                    <Spinner />
                                ) : (
                                    <Transactions
                                        explorerURL={wallet.blockExplorerTxPrefix}
                                        transactions={transactions}
                                        className={noTransactions ? 'isVerticallyCentered' : ''}
                                    />
                                )
                            }
                        </div>
                    </div>
                    <Guide guide={guide} screen="account">
                        {noTransactions && balance && <Entry title={t('guide.accountEmpty.title')}>
                            <p>{t('guide.accountEmpty.text', { unit: balance.unit })}</p>
                        </Entry>}
                        {balance && <Entry title={t('guide.accountReceive.title', { unit: balance.unit })}>
                            <p>{t('guide.accountReceive.text')}</p>
                        </Entry>}
                        {balance && balance.available === '0' && <Entry title={t('guide.accountSendDisabled.title', { unit: balance.unit })}>
                            <p>{t('guide.accountSendDisabled.text')}</p>
                        </Entry>}
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
                    code={this.props.code}
                    onClose={() => this.setState({ isReceive: false })}
                    guide={guide}
                />
            );
        } else if (isSend) {
            return (
                <Send
                    isConfirming={isConfirming}
                    setConfirmation={state => this.setState(state)}
                    wallet={wallet}
                    walletCode={wallet.code}
                    walletInitialized={walletInitialized}
                    balance={balance}
                    unit={balance.unit}
                    onClose={() => this.setState({ isSend: false })}
                    guide={guide}
                />
            );
        }
    }
}
