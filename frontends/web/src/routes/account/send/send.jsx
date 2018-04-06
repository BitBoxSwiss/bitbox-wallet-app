import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import Checkbox from 'preact-material-components/Checkbox';
import Formfield from 'preact-material-components/Formfield';
import 'preact-material-components/Checkbox/style.css';

import WaitDialog from '../../../components/wait-dialog/wait-dialog';

import { apiPost } from '../../../utils/request';


import FeeTargets from './feetargets';

export default class Send extends Component {
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
        apiPost('wallet/' + this.props.walletCode + '/sendtx', this.txInput())
            .then(() => {
                this.waitDialog.MDComponent.close();
            });
    };

    txInput = () => ({
        address: this.state.recipientAddress,
        amount: this.state.amount,
        feeTarget: this.state.feeTarget,
        sendAll: this.state.sendAll ? 'yes' : 'no'
    })

    validateAndDisplayFee = () => {
        this.setState({ proposedFee: null });
        const txInput = this.txInput();
        if (!txInput.feeTarget || (txInput.sendAll === 'no' && !txInput.amount)) {
            // TODO proper validation
            return;
        }
        apiPost('wallet/' + this.props.walletCode + '/tx-proposal', txInput).then(({ amount, fee }) => {
            this.setState({ proposedFee: fee, proposedAmount: amount });
        });
    }

    handleFormChange = event => {
        let value = event.target.value;
        if (event.target.id === 'sendAll') {
            value = event.target.checked;
        }
        this.setState({
            [event.target.id]: value,
            proposedFee: null
        });
    };

    render({ walletCode, walletInitialized }, { proposedFee, recipientAddress, proposedAmount, amount, sendAll }) {
        let Fee = () => {
            if (!proposedFee) return;
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
                                autoComplete="off"
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
                                autoComplete="off"
                                label={ sendAll ? '' : 'Amount BTC' }
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
                                onFeeTargetChange={feeTarget => { this.setState({ feeTarget }); this.validateAndDisplayFee(); }}
                            />
                            <Fee />
                        </p>
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
                        <Dialog.FooterButton accept={true}>Send</Dialog.FooterButton>
                    </Dialog.Footer>
                </Dialog>
                <WaitDialog ref={waitDialog => { this.waitDialog = waitDialog; }}>
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
