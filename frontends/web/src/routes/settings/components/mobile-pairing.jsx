import { Component } from 'preact';
import { Button } from '../../../components/forms';
import Dialog from 'preact-material-components/Dialog';
import QRCode from '../../../routes/account/receive/qrcode';
import { apiGet, apiPost } from '../../../utils/request';
import componentStyle from '../../../components/style.css';
import 'preact-material-components/Button/style.css';
import 'preact-material-components/Dialog/style.css';

export default class MobilePairing extends Component {
  state = {
    channel: null,
  }

  startPairing = () => {
    this.setState({ channel: null });
    apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
      this.setState({ channel: channel });
      this.dialog.MDComponent.show();
    });
  }

  render({}, { channel }) {
    return (
      <span>
        <Button secondary onClick={this.startPairing}>
            Pair with Mobile
        </Button>
        <Dialog ref={dialog => { this.dialog = dialog; }} onAccept={this.send}>
          <Dialog.Header>Scan with Mobile</Dialog.Header>
          <Dialog.Body>
            { channel ?
                <center>
                  <p><QRCode data={JSON.stringify(channel)} /></p>
                </center>
                : 'loading…'}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.FooterButton cancel={true}>Close</Dialog.FooterButton>
          </Dialog.Footer>
        </Dialog>
      </span>
    );
  }
}
