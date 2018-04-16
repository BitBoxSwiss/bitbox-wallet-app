import { Component } from 'preact';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';

import Balance from '../../components/balance/balance';
import Send from './send/send';
import Receive from './receive/receive';

import Transactions from '../../components/transactions/transactions';

import style from './account.css';

export default class Account extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            transactions: [],
            walletConnected: false,
            balance: {
                available: '',
                incoming: '',
                hasIncoming: false
            }
        };
    }

    componentDidMount() {
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(this.onWalletEvent);
        apiGet('device/info').then(({ sdcard }) => {
            if (sdcard) {
                alert('Keep the SD card stored securely unless you want to manage backups.');
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.code !== prevProps.code) {
            console.log("componentDidUpdate(" + this.props.code + ")")
            this.onStatusChanged();
        }
    }

    onWalletEvent = data => {
        if (data.type !== 'wallet') {
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
        console.log("Wallet " + this.props.code + " requesting status.")
        apiGet("wallet/" + this.props.code + "/status").then(status => {
            if (status == "initialized") {
                this.setState({ walletInitialized: true,
                        walletConnected: true
                    });
            } else if (status == "connected") {
                this.setState({ walletInitialized: false,
                        walletConnected: true
                    });
            } else {
                this.setState({ walletInitialized: false,
                        walletConnected: false
                    });
            }
            this.onWalletChanged();
        });
    }

    onWalletChanged = () => {
        if (this.state.walletInitialized && this.state.walletConnected) {
            console.log("Wallet " + this.props.code + " initialized.")
            apiGet('wallet/' + this.props.code + '/transactions').then(transactions => {
                this.setState({ transactions });
            });
            apiGet('wallet/' + this.props.code + '/balance').then(balance => {
                this.setState({ balance });
            });
        } else {
            console.log("Wallet " + this.props.code + " disconnected. Should rerender")
            this.setState(
                { balance: {
                    available: 0,
                    hasIncoming: false,
                    incoming: 0,
                }
            });
        }
    }

    render({ wallets }, { walletInitialized, transactions, walletConnected, balance }) {

        const wallet = wallets.find(({ code }) => code === this.props.code);

        if (!wallet) return null;

        return (
            <div class={style.container}>
                <div class={style.controls}>
                    <Receive code={this.props.code} />
                    &nbsp;
                    <Send
                        walletCode={ wallet.code }
                        walletInitialized={ walletInitialized }
                    />
                </div>

                <Balance name={wallet.name} amount={balance.available}>
                    { balance.hasIncoming && <span>(Pending {balance.incoming})</span> }
                </Balance>

                { !walletInitialized
                    ? <div>Initializing.</div>
                    : (
                        <Transactions
                            explorerURL={wallet.blockExplorerTxPrefix}
                            transactions={transactions}
                        />
                    )
                }
                { walletConnected &&
                <div class="connection-status" style="background: green; color: white">
                    <p>Connection established</p>
                </div>
                }
                { !walletConnected &&
                <div class="connection-status" style="background: red; color: white">
                    <p>Connection lost. Retrying...</p>
                </div>
                }
            </div>
        );
    }
}
