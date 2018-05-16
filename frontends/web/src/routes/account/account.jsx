import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';
import { Button } from '../../components/forms';
import Balance from '../../components/balance/balance';
import Send from './send/send';
import Receive from './receive/receive';
import Transactions from '../../components/transactions/transactions';
import componentStyle from '../../components/style.css';
import style from './account.css';

@translate()
export default class Account extends Component {
    state = {
        walletInitialized: false,
        transactions: [],
        walletConnected: false,
        balance: null,
        isReceive: false,
        isSend: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentDidMount() {
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(this.onWalletEvent);
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
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
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
        console.log('Wallet ' + this.props.code + ' requesting status.')
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
        wallets,
    }, {
        walletInitialized,
        transactions,
        walletConnected,
        balance,
        isReceive,
        isSend,
    }) {
        const wallet = wallets.find(({ code }) => code === this.props.code);
        if (!wallet) return null;
        // currently no status if everything is ok 'account.connect'
        const connectionStatusContainer = walletConnected ? null : (
            <div class={style.connectionStatusContainer}>
                <div class={[style.connectionStatus, style.warning].join(' ')}>
                    <p>{t('account.disconnect')}</p>
                </div>
            </div>
        );

        if (!isReceive && !isSend) {
            return (
                <div class="container">
                    <div class="headerContainer fixed">
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
                            <div class={componentStyle.buttons}>
                                <Button primary onClick={() => this.setState({ isReceive: true })}>
                                    {t('button.receive')}
                                </Button>
                                <Button primary onClick={() => this.setState({ isSend: true })}>
                                    {t('button.send')}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div class="innerContainer withFixedContent">
                        {connectionStatusContainer}
                        <div class="">
                            {
                                !walletInitialized ? (
                                    <div class="flex flex-row flex-center">
                                        <p style="font-weight: bold;">{t('account.initializing')}</p>
                                    </div>
                                ) : (
                                    <Transactions
                                        explorerURL={wallet.blockExplorerTxPrefix}
                                        transactions={transactions}
                                    />
                                )
                            }
                        </div>
                    </div>
                </div>
            );
        } else if (isReceive) {
            return (
                <Receive
                    code={this.props.code}
                    onClose={() => this.setState({ isReceive: false })}
                />
            );
        } else if (isSend) {
            return (
                <Send
                    walletCode={wallet.code}
                    walletInitialized={walletInitialized}
                    unit={balance.unit}
                    onClose={() => this.setState({ isSend: false })}
                />
            );
        }
    }
}
