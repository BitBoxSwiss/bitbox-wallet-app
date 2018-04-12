import { Component } from 'preact';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { apiGet } from '../../utils/request';
import { apiWebsocket } from '../../utils/websocket';

import Balance from '../../components/balance/balance';
import Send from './send/send';
import Receive from './receive/receive';


export default class Account extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            transactions: [],
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

    componentWillReceiveProps() {
        this.onStatusChanged();
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
        apiGet('wallet/' + this.props.code + '/status').then(initialized => {
            this.setState({ walletInitialized: initialized });
            this.onWalletChanged();
        });
    }

    onWalletChanged = () => {
        if (this.state.walletInitialized) {
            apiGet('wallet/' + this.props.code + '/transactions').then(transactions => {
                this.setState({ transactions });
            });
            apiGet('wallet/' + this.props.code + '/balance').then(balance => {
                this.setState({ balance });
            });
        }
    }

    render({ wallets }, { walletInitialized, transactions, balance }) {

        const wallet = wallets.find(({ code }) => code === this.props.code);

        if (!wallet) return null;

        const renderTransaction = transaction => (
            <List.Item>
                <a href={ wallet.blockExplorerTxPrefix + transaction.id } target="_blank">{ transaction.id }</a>&nbsp;–
                Height { transaction.height } –
                Amount { transaction.amount } –
                Fee { transaction.fee } –
                Type { transaction.type }
            </List.Item>
        );

        const renderTransactions = transactions => {
            if (!walletInitialized) { return <div>Initializing.</div>; }
            if (transactions.length === 0) { return <div>No transactions yet.</div>; }
            return <List>{ transactions.map(renderTransaction) }</List>;
        };

        return (
            <div style="margin-left: 1rem;">
                <Balance name={wallet.name} amount={balance.available} />

                { balance.hasIncoming && <span>(+{balance.incoming} incoming)</span> }
                { renderTransactions(transactions) }
                <p>
                    <Send
                        walletCode={ wallet.code }
                        walletInitialized={ walletInitialized }
                    />
                    &nbsp;
                    <Receive code={this.props.code} />
                </p>
            </div>
        );
    }
}
