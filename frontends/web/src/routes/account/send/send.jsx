import { Component } from 'preact';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../utils/request';
import FeeTargets from './feetargets';
import Toast from '../../../components/toast/Toast';
import componentStyle from '../../../components/style.css';
import style from './send.css';

export default class Send extends Component {
  state = {
    feeTarget: null,
    proposedFee: null,
    proposedAmount: null,
    sendAll: false,
    isConfirming: false,
    isSent: false,
  }

  send = () => {
    this.setState({ isConfirming: true });
    apiPost('wallet/' + this.props.walletCode + '/sendtx', this.txInput()).then(res => {
      if (res.success) {
        this.setState({
          isConfirming: false,
          isSent: true,
          recipientAddress: null,
          proposedAmount: null,
          proposedFee: null,
          amount: null,
        });
      }
    });
  }

  txInput = () => ({
    address: this.state.recipientAddress,
    amount: this.state.amount,
    feeTarget: this.state.feeTarget,
    sendAll: this.state.sendAll ? 'yes' : 'no',
  })

  validateAndDisplayFee = () => {
    this.setState({ proposedFee: null });
    const txInput = this.txInput();
    if (!txInput.feeTarget || (txInput.sendAll === 'no' && !txInput.amount)) {
      // TODO proper validation
      return;
    }
    apiPost('wallet/' + this.props.walletCode + '/tx-proposal', txInput).then(({ amount, fee }) => {
      this.setState({
        proposedFee: fee,
        proposedAmount: amount,
      });
    });
  }

  handleFormChange = event => {
    let value = event.target.value;
    if (event.target.id === 'sendAll') {
      value = event.target.checked;
    }
    this.setState({
      [event.target.id]: value,
      proposedFee: null,
    });
  }

  sendAll = event => {
    this.handleFormChange(event);
    this.validateAndDisplayFee();
  }

  feeTargetChange = feeTarget => {
    this.setState({ feeTarget });
    this.validateAndDisplayFee();
  }

  render({ walletCode, walletInitialized }, { proposedFee, recipientAddress, proposedAmount, amount, sendAll }) {
    console.log(this.state)
    return (
      <div class="innerContainer">
        <div class="header">
          <h2>Send Coins</h2>
        </div>
        <div class="content">
          <div class="row">
            <div class="flex flex-row flex-between flex-items-center">
              <p class="label">Address</p>
            </div>
            <input
              type="text"
              class={[style.input, style.inputFull].join(' ')}
              id="recipientAddress"
              onInput={this.handleFormChange}
              onChange={this.validateAndDisplayFee}
              value={recipientAddress}
              placeholder="Enter bitcoin address"
              autocomplete="off"
              autofocus
            />
          </div>
          <div class="row">
            <div class="flex flex-row flex-between flex-items-center">
              <p class="label">Amount</p>
              <p class="label">
                <label>
                  <input
                    type="checkbox"
                    id="sendAll"
                    style="margin-right: 5px;"
                    onChange={this.sendAll}
                    checked={sendAll}
                  />
                  Maximum Amount
                </label>
              </p>
            </div>
            <div class="flex flex-row flex-between flex-items-center">
              <input
                type="text"
                class={[style.input, style.inputFull, sendAll ? style.notAllowed : null].join(' ')}
                id="amount"
                autocomplete="off"
                onInput={this.handleFormChange}
                onChange={this.validateAndDisplayFee}
                disabled={sendAll}
                value={sendAll ? proposedAmount : amount}
                placeholder="Enter bitcoin amount"
              />
            </div>
          </div>
          <div class="row">
            <div class="flex flex-row flex-start flex-items-center">
              <p class={['label', style.labelHalf].join(' ')}>Bitcoin Network Fee</p>
              <p class={['label', style.labelHalf].join(' ')}>Network Priority</p>
            </div>
            <div class="flex flex-row flex-between flex-items-center">
              <input
                type="text"
                class={[style.input, style.inputHalf, style.notAllowed].join(' ')}
                value={ proposedFee ? proposedFee : 'Not available'}
                disabled
              />
              <FeeTargets
                walletCode={walletCode}
                disabled={!amount && !sendAll}
                walletInitialized={walletInitialized}
                onFeeTargetChange={this.feeTargetChange}
              />
            </div>
          </div>
        </div>
        <div class={[componentStyle.buttons, 'flex', 'flex-row', 'flex-end'].join(' ')}>
          <button class={[componentStyle.button, componentStyle.isPrimary].join(' ')} onClick={this.props.onClose}>Cancel</button>
          <button class={[componentStyle.button, componentStyle.isPrimary].join(' ')} onClick={this.send}>Send</button>
        </div>
        <WaitDialog
          active={this.state.isConfirming}
          title="Confirm Transaction"
        />
        <Toast
          trigger={this.state.isSent}
          theme="success"
          message="Your transaction was successful."
          onHide={() => this.setState({ isSent: false })}
        />
      </div>
    );
  }
}
