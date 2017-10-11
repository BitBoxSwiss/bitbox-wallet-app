import { Component } from 'preact';
import { apiGet } from '../../util';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import WaitDialog from '../../components/wait-dialog';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { apiPost } from '../../util';

class SendButton extends Component {
    send = () => {
        this.waitDialog.MDComponent.show();
        apiPost("wallet/btc/sendtx", {
            address: this.state.recipientAddress,
            amount: this.state.amount
        }).then(() => { this.waitDialog.MDComponent.close(); });
    };

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    render({}, { recipientAddress, amount }) {
        return (
            <div>
              <Button primary={true} raised={true} onClick={()=>{
                    this.dialog.MDComponent.show();
                }}>Send</Button>
              <Dialog ref={dialog=>{this.dialog=dialog;}} onAccept={this.send}>
                <Dialog.Header>Send</Dialog.Header>
                <Dialog.Body>
                  <p>
                    <Textfield
                      autoFocus
                      id="recipientAddress"
                      label="Recipient Address"
                      helptext="Please enter the address of the recipient"
                      helptextPersistent={true}
                      onInput={this.handleFormChange}
                      value={recipientAddress}
                      />
                  </p>
                  <p>
                    <Textfield
                      autoFocus
                      id="amount"
                      label="Amount BTC"
                      helptext="Please enter the BTC amount to send"
                      helptextPersistent={true}
                      onInput={this.handleFormChange}
                      value={amount}
                      />
                  </p>
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
                  <Dialog.FooterButton accept={true}>Send</Dialog.FooterButton>
                </Dialog.Footer>
              </Dialog>
              <WaitDialog ref={waitDialog=>{this.waitDialog=waitDialog;}}>
                <WaitDialog.Header>Confirm transaction</WaitDialog.Header>
                <WaitDialog.Body>
                  <p>Short touch = abort</p>
                  <p>Long touch = confirm</p>
                </WaitDialog.Body>
              </WaitDialog>
            </div>
        );
    }
}

export default class Wallet extends Component {
    constructor(props) {
        super(props);
        this.state = {
            transactions: [],
            balance: {
                confirmed: "",
                unconfirmed: ""
            }
        };
    }

    componentDidMount() {
        this.props.registerOnWalletChanged(this.onWalletChanged);
        this.onWalletChanged();
    }

    componentWillUnmount() {
        this.props.registerOnWalletChanged(null);
    }

    onWalletChanged = () => {
        if(this.props.walletInitialized) {
            apiGet("wallet/btc/transactions").then(transactions => {
                this.setState({ transactions: transactions });
            });
            apiGet("wallet/btc/balance").then(balance => {
                this.setState({ balance: balance });
            });
        }
    }

    render({ walletInitialized }, { transactions, balance }) {
        const renderTransactions = transactions => {
            if(!walletInitialized) {
                return (
                    <div>
                      Initializing.
                    </div>
                );
            }
            if(!transactions) {
                return (
                    <div>
                      No transactions yet.
                    </div>
                );
            }
            return (
                <List>
                  { transactions.map(renderTransaction) }
                </List>
            );
        };
        const renderTransaction = transaction => <List.Item>{ transaction.id } - Height { transaction.height } - Amount { transaction.amount } - Fee { transaction.fee } - Type { transaction.type }</List.Item>;
        return (
            <div>
              <h1>Wallet</h1>
              <p><SendButton/></p>
              <h2>Amount</h2>
              { balance.confirmed } { balance.unconfirmed && <span>({balance.unconfirmed})</span> }
              <h2>Transactions</h2>
              { renderTransactions(transactions) }
            </div>
        );
    }
}
