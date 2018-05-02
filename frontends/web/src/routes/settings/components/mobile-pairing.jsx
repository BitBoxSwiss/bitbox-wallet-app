import { Component } from 'preact';
import { Button } from '../../../components/forms';
import Dialog from 'preact-material-components/Dialog';
import QRCode from '../../../routes/account/receive/qrcode';
import { apiGet, apiPost } from '../../../utils/request';
import componentStyle from '../../../components/style.css';

export default class MobilePairing extends Component {
  state = {
    channel: null,
    active: false,
  }

  startPairing = () => {
    this.setState({ channel: null });
    apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
      this.setState({
        channel: channel,
        active: true,
      });
    });
  }

  render({}, {
    channel,
    active,
  }) {
    return (
      <div>
        <Button secondary onClick={this.startPairing}>
          Pair with Mobile
        </Button>
        <div class={['overlay', active ? 'active' : ''].join(' ')}>
          <div class={['modal', active ? 'active' : ''].join(' ')}>
            <div class="flex flex-column flex-center flex-items-center">
              <h3 class="modalHeader">Scan with a Mobile Device</h3>
              {
                channel ? (
                  <QRCode data={JSON.stringify(channel)} />
                ) : (
                  <p>Loading...</p>
                )
              }
              <div>
                <button
                  class={[componentStyle.button, componentStyle.isPrimary].join(' ')}
                  onClick={() => this.setState({ active: false })}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
