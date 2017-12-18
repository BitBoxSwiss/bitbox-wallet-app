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

import Checkbox from 'preact-material-components/Checkbox';
import Formfield from 'preact-material-components/Formfield';
import 'preact-material-components/Checkbox/style.css';

import WaitDialog from '../../components/wait-dialog';

import List from 'preact-material-components/List';
import 'preact-material-components/List/style.css';

import { translate } from 'react-i18next';

import { apiURL, apiGet, apiPost } from '../../util';

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
        apiGet("wallet/" + this.props.walletCode + "/fee-targets").then(({ feeTargets, defaultFeeTarget }) => {
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

    render({ disabled }, { feeTargets, feeTarget }) {
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
              disabled={disabled}
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
            feeTarget: null,
            proposedFee: null,
            proposedAmount: null,
            sendAll: false
        };
    }

    send = () => {
        this.waitDialog.MDComponent.show();
        apiPost("wallet/" + this.props.walletCode + "/sendtx", this.txInput()).then(() => { this.waitDialog.MDComponent.close(); });
    };

    txInput = () => {
        return {
            address: this.state.recipientAddress,
            amount: this.state.amount,
            feeTarget: this.state.feeTarget,
            sendAll: this.state.sendAll ? "yes" : "no"
        };
    }

    validateAndDisplayFee = () => {
        this.setState({ proposedFee: null });
        const txInput = this.txInput();
        if(!txInput.feeTarget || (txInput.sendAll == "no" && !txInput.amount)) {
            // TODO proper validation
            return;
        }
        apiPost("wallet/" + this.props.walletCode + "/tx-proposal", txInput).then(({ amount, fee }) => {
            this.setState({ proposedFee: fee, proposedAmount: amount });
        });
    }

    handleFormChange = event => {
        let value = event.target.value;
        if(event.target.id == "sendAll") {
            value = event.target.checked;
        }
        this.setState({
            [event.target.id]: value,
            proposedFee: null
        });
    };

    render({ walletCode, walletInitialized }, { proposedFee, recipientAddress, proposedAmount, amount, sendAll }) {
        let Fee = () => {
            if(!proposedFee) return;
            return <span> Fee: { proposedFee }</span>;
        };
        return (
            <span>
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
                      onChange={this.validateAndDisplayFee}
                      value={recipientAddress}
                      />
                  </p>
                  <p>
                    <Textfield
                      id="amount"
                      label={ sendAll ? "" : "Amount BTC" }
                      helptext="Please enter the BTC amount to send"
                      helptextPersistent={true}
                      onInput={this.handleFormChange}
                      onChange={this.validateAndDisplayFee}
                      disabled={sendAll}
                      value={sendAll ? proposedAmount : amount}
                      />
                    <Formfield>
                      <Checkbox
                        id="sendAll"
                        onChange={event => { this.handleFormChange(event); this.validateAndDisplayFee(); }}
                        checked={sendAll}
                        />
                      <label for="sendAll">Max</label>
                    </Formfield>
                    <FeeTargets
                      walletCode={walletCode}
                      disabled={!amount && !sendAll}
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
            </span>
        );
    }
}

function QRCode({ data }) {
    return (
        <img
          width={256}
          src={apiURL("qr?data=" + encodeURIComponent(data))}
          />
    );
}

class ReceiveButton extends Component {
    constructor(props) {
        super(props);
    }

    render({ receiveAddress }) {
        return (
            <span>
              <Button primary={true} raised={true} onClick={()=>{
                    this.dialog.MDComponent.show();
                }}>Receive</Button>
              <Dialog ref={dialog=>{this.dialog=dialog;}} onAccept={this.send}>
                <Dialog.Header>Receive</Dialog.Header>
                <Dialog.Body>
                  <center>
                    <Textfield
                      size="36"
                      autoFocus
                      readonly={true}
                      onInput={this.handleFormChange}
                      onFocus={event => event.target.select() }
                      value={receiveAddress}
                      />
                      <p><QRCode data={receiveAddress}/></p>
                  </center>
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.FooterButton cancel={true}>Close</Dialog.FooterButton>
                </Dialog.Footer>
              </Dialog>
            </span>
        );
    }
};

class Wallet extends Component {
    constructor(props) {
        super(props);
        this.state = {
            walletInitialized: false,
            transactions: [],
            balance: {
                confirmed: "",
                unconfirmed: ""
            },
            receiveAddress: null
        };
    }

    componentDidMount() {
        this.props.registerOnWalletEvent(this.onWalletEvent.bind(this));
        apiGet("wallet/" + this.props.walletCode + "/status").then(status => {
            this.setState({ walletInitialized: status == "initialized" });
            this.onWalletChanged();
        });
    }

    componentWillUnmount() {
        this.props.registerOnWalletEvent(null);
    }

    onWalletEvent = data => {
        switch(data.data) {
        case "initialized":
            this.setState({ walletInitialized: true });
            break;
        case "uninitialized":
            this.setState({ walletInitialized: false });
            break;
        case "syncdone":
            this.onWalletChanged();
            break;
        }
    }

    onWalletChanged = () => {
        if(this.state.walletInitialized) {
            apiGet("wallet/" + this.props.walletCode + "/transactions").then(transactions => {
                this.setState({ transactions: transactions });
            });
            apiGet("wallet/" + this.props.walletCode + "/balance").then(balance => {
                this.setState({ balance: balance });
            });
            apiGet("wallet/" + this.props.walletCode + "/receive-address").then(address => {
                this.setState({ receiveAddress: address });
            });
        }
    }

    render({show, walletCode}, { walletInitialized, transactions, balance, receiveAddress }) {
        if(!show) return;

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
              <h2>{walletCode}</h2>
              <p>
                <SendButton
                  walletCode={walletCode}
                  walletInitialized={walletInitialized}/>
                &nbsp;
                <ReceiveButton receiveAddress={receiveAddress}/>
              </p>
              <h2>Amount</h2>
              { balance.confirmed } { balance.unconfirmed && <span>({balance.unconfirmed})</span> }
              <h2>Transactions</h2>
              { renderTransactions(transactions) }
            </div>
        );
    }
}

@translate()
export default class Wallets extends Component {
    constructor(props) {
        super(props);
        this.onWalletEvents = {};
        this.state = {
            activeCoin: "tbtc"
        };
    }

    componentDidMount() {
        this.props.registerOnWalletEvent(function(data) {
            if(this.onWalletEvents[data.code]) {
                this.onWalletEvents[data.code](data);
            } else {
                console.log("ignoring event for wallet " + data.code);
            }
        }.bind(this));
    }

    render({}, { activeCoin }) {
        const this_ = this;
        function CoinLink({code}) {
            return (
                <Button primary={true} raised={true} onClick={()=>{
                    this_.setState({ activeCoin: code });
                }}>{this.props.children}</Button>
            );
        }
        return (
            <div>
              <CoinLink code="tbtc">Bitcoin Testnet</CoinLink>
              &nbsp;
              <CoinLink code="tbtc-p2wpkh-p2sh">Bitcoin Testnet Segwit</CoinLink>
              &nbsp;
              <CoinLink code="btc">Bitcoin</CoinLink>
              &nbsp;
              <CoinLink code="btc-p2wpkh-p2sh">Bitcoin Segwit</CoinLink>
              &nbsp;
              <CoinLink code="tltc">Litecoin Testnet</CoinLink>
              &nbsp;
              <CoinLink code="ltc">Litecoin</CoinLink>
              <Wallet
                walletCode="tbtc"
                show={activeCoin == "tbtc"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["tbtc"] = onWalletEvent; }}
                />
              <Wallet
                walletCode="tbtc-p2wpkh-p2sh"
                show={activeCoin == "tbtc-p2wpkh-p2sh"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["tbtc-p2wpkh-p2sh"] = onWalletEvent; }}
                />
              <Wallet
                walletCode="btc"
                show={activeCoin == "btc"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["btc"] = onWalletEvent; }}
              />
              <Wallet
                walletCode="btc-p2wpkh-p2sh"
                show={activeCoin == "btc-p2wpkh-p2sh"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["btc-p2wpkh-p2sh"] = onWalletEvent; }}
                />
              <Wallet
                walletCode="tltc"
                show={activeCoin == "tltc"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["tltc"] = onWalletEvent; }}
              />
              <Wallet
                walletCode="ltc"
                show={activeCoin == "ltc"}
                registerOnWalletEvent={onWalletEvent => { this.onWalletEvents["ltc"] = onWalletEvent; }}
                  />
            </div>
        );
    }
}
