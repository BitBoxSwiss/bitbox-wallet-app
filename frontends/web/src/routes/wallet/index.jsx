import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import Select from 'preact-material-components/Select';
import 'preact-material-components/List/style.css';
import 'preact-material-components/Menu/style.css';
import 'preact-material-components/Select/style.css';

import WaitDialog from '../../components/wait-dialog';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { apiGet, apiPost } from '../../util';

class FeeTargets extends Component {
    constructor(props) {
        super(props);
        this.state = {
            feeTargets: null,
            feeTarget: null
        };
    }

    componentDidMount() {
        if(this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    componentWillReceiveProps({ walletInitialized }) {
        if(walletInitialized && !this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    updateFeeTargets = () => {
        apiGet("wallet/btc/fee-targets").then(({ feeTargets, defaultFeeTarget }) => {
            this.setState({
                feeTargets: feeTargets
            });
            this.setFeeTarget(defaultFeeTarget);
        });
    }

    handleFeeTargetChange = event => {
        this.setFeeTarget(this.state.feeTargets[event.target.selectedIndex].code);
    }

    setFeeTarget = feeTarget => {
        this.setState({ feeTarget: feeTarget });
        this.props.onFeeTargetChange(feeTarget);
    }

    render({ amount }, { feeTargets, feeTarget }) {
        if(!feeTargets) {
            return (
                <span>Fetching fee data</span>
            );
        }
        const option = target => <option
        value={ target.code }
        className="mdc-list-item"
        selected={ feeTarget == target.code }
            >{ target.code }</option>;
        return (
            <select
              disabled={!amount}
              id="feeTarget"
              className="mdc-list"
              onChange={this.handleFeeTargetChange}
              >{ feeTargets && feeTargets.map(option) }
            </select>
        );
    }
}

class SendButton extends Component {
    constructor(props) {
        super(props);
        this.state = {
            feeTarget: null
        };
    }

    send = () => {
        this.waitDialog.MDComponent.show();
        apiPost("wallet/btc/sendtx", this.txInput()).then(() => { this.waitDialog.MDComponent.close(); });
    };

    txInput = () => {
        return {
            address: this.state.recipientAddress,
            amount: this.state.amount,
            feeTarget: this.state.feeTarget
        };
    }

    validateAndDisplayFee = () => {
        this.setState({ fee: null });
        const txInput = this.txInput();
        if(!txInput.feeTarget || !txInput.amount) {
            // TODO proper validation
            return;
        }
        apiPost("wallet/btc/tx-fee", txInput).then(fee => {
            this.setState({ fee: fee });
        });
    }

    handleFormChange = event => {
        this.setState({
            [event.target.id]: event.target.value,
            fee: null
        });
    };

    render({ walletInitialized }, { fee, recipientAddress, amount }) {
        let Fee = () => {
            if(!fee) return;
            return <span> Fee: { fee }</span>;
        };
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
                      onChange={this.validateAndDisplayFee}
                      value={amount}
                      />
                    <FeeTargets
                      amount={amount}
                      walletInitialized={walletInitialized}
                      onFeeTargetChange={feeTarget => { this.setState({ feeTarget: feeTarget }); this.validateAndDisplayFee(); }}
                      /><Fee/>
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
              <p><SendButton walletInitialized={walletInitialized}/></p>
              <h2>Amount</h2>
              { balance.confirmed } { balance.unconfirmed && <span>({balance.unconfirmed})</span> }
              <h2>Transactions</h2>
              { renderTransactions(transactions) }
            </div>
        );
    }
}
