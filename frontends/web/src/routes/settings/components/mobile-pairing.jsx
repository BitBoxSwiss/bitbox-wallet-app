import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import QRCode from '../../../routes/account/receive/qrcode';

import { apiGet, apiPost } from '../../../utils/request';

export default class MobilePairing extends Component {
    constructor(props) {
        super(props);
        this.state = { channel: null };
    }

    startPairing = () => {
        this.setState({ channel: null });

        apiPost('device/pairing/start').then(channel => {
            this.setState({ channel: channel });
            this.dialog.MDComponent.show();
        });
    }

    render({}, { channel }) {
        return (
            <span>
                <Button primary={true} raised={true} onClick={this.startPairing}>
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
