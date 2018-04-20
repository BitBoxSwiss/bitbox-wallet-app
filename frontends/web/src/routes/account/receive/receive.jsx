import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import QRCode from './qrcode';
import componentStyle from '../../../components/style.css';
import style from './receive.css';

export default class ReceiveButton extends Component {
  constructor(props) {
    super(props);
    this.state = { receiveAddress: null };
  }

  componentDidMount() {
    apiGet('wallet/' + this.props.code + '/receive-address').then(address => {
      this.setState({ receiveAddress: address });
    });
  }

  onReceive = () => {
    this.setState({ receiveAddress: null });
    apiGet('wallet/' + this.props.code + '/receive-address').then(address => {
      this.setState({ receiveAddress: address });
    });
    this.dialog.MDComponent.show();
  }

  render({}, { receiveAddress }) {
    return (
      <div class="innerContainer">
        <div class="header">
          <h2>Get Coins</h2>
        </div>
        <div class="content isVerticallyCentered">
          {
            receiveAddress ? (
              <div class={style.receiveContent}>
                <p class="label">Your bitcoin address</p>
                <div><QRCode data={receiveAddress} /></div>
                <p><input type="text" class={style.addressField} value={receiveAddress} onFocus={focus} autocomplete="off" autofocus readonly /></p>
              </div>
            ) : (
              'loading…'
            )
          }
        </div>
        <div class="flex flex-row flex-end">
          <button class={[componentStyle.button, componentStyle.isPrimary].join(' ')} onClick={this.props.onClose}>Cancel</button>
        </div>
      </div>
    );
  }
}

function focus(e) {
  e.target.select();
}
