import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import QRCode from './qrcode';

export default class ReceiveButton extends Component {
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
