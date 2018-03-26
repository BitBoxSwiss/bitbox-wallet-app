import { Component } from 'preact';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { apiGet } from '../../utils/request';

import Send from './send/send';
import Receive from './receive/receive';


export default class Account extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            transactions: [],
            balance: {
                available: "",
                incoming: "",
                hasIncoming: false
            },
            receiveAddress: null
        };
    }

    componentDidMount() {
        this.props.registerOnWalletEvent(this.onWalletEvent.bind(this));
        this.onStatusChanged();
    }

    componentWillUnmount() {
        this.props.registerOnWalletEvent(null);
    }

    onWalletEvent = data => {
        switch(data.data) {
        case "statusChanged":
            this.onStatusChanged();
            break;
        case "syncdone":
            this.onWalletChanged();
            break;
        }
    }

    onStatusChanged = () => {
        apiGet("wallet/" + this.props.wallet.code + "/status").then(initialized => {
            this.setState({ walletInitialized: initialized });
            this.onWalletChanged();
        });
    }

    onWalletChanged = () => {
        if(this.state.walletInitialized) {
            apiGet("wallet/" + this.props.wallet.code + "/transactions").then(transactions => {
                this.setState({ transactions: transactions });
            });
            apiGet("wallet/" + this.props.wallet.code + "/balance").then(balance => {
                this.setState({ balance: balance });
            });
            apiGet("wallet/" + this.props.wallet.code + "/receive-address").then(address => {
                this.setState({ receiveAddress: address });
            });
        }
    }

    render({show, wallet}, { walletInitialized, transactions, balance, receiveAddress }) {
        if (!show) return;

        const renderTransaction = transaction => <List.Item>
            <a href={ wallet.blockExplorerTxPrefix + transaction.id } target="_blank">{ transaction.id }</a>&nbsp;–
            Height { transaction.height } –
            Amount { transaction.amount } –
            Fee { transaction.fee } –
            Type { transaction.type }
        </List.Item>;

        const renderTransactions = transactions => {
            if (!walletInitialized) { return <div>Initializing.</div>; }
            if (transactions.length == 0) { return <div>No transactions yet.</div>; }
            return <List>{ transactions.map(renderTransaction) }</List>;
        };

        return (
            <div>
                <h2>{ wallet.name }</h2>
                <p>
                    <Send
                    walletCode={ wallet.code }
                    walletInitialized={ walletInitialized }/>
                    &nbsp;
                    <Receive receiveAddress={ receiveAddress }/>
                </p>
                <h2>Amount</h2>
                Available balance to spend: { balance.available } { balance.hasIncoming && <span>(+{balance.incoming} incoming)</span> }
                <h2>Transactions</h2>
                { renderTransactions(transactions) }
            </div>
        );
    }
}
