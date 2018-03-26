import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import { apiGet } from '../../../utils/request';

import QRCode from './qrcode';

export default class ReceiveButton extends Component {
    constructor(props) {
        super(props);
        this.state = { receiveAddress: null };
    }

    onReceive = () => {
        this.setState({ receiveAddress: null });

        apiGet("wallet/" + this.props.code + "/receive-address")
        .then(address => {
            this.setState({ receiveAddress: address });
        });
        this.dialog.MDComponent.show();
    }

    render({}, { receiveAddress }) {
        return (
            <span>
              <Button primary={true} raised={true} onClick={this.onReceive}>
                Receive
              </Button>
              <Dialog ref={dialog => { this.dialog = dialog;}} onAccept={this.send}>
                <Dialog.Header>Receive</Dialog.Header>
                <Dialog.Body>
                  { receiveAddress ?
                  <center>
                    <Textfield
                      size="36"
                      autoFocus
                      autoComplete="off"
                      readonly={true}
                      onInput={this.handleFormChange}
                      onFocus={event => event.target.select() }
                      value={receiveAddress}
                      />
                      <p><QRCode data={receiveAddress}/></p>
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
};
