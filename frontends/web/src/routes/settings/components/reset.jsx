import { Component } from 'preact';

import { Button } from '../../../components/forms';
import Dialog from 'preact-material-components/Dialog';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../utils/request';
import 'preact-material-components/Button/style.css';
import 'preact-material-components/Dialog/style.css';


export default class Reset extends Component {
  state = {
    isConfirming: false,
  }

  resetDevice = () => {
    this.setState({ isConfirming: true });
    apiPost('devices/' + this.props.deviceID + '/reset').then(() => {
      this.setState({ isConfirming: false });
    });
  };

  showDialog = () => {
    this.resetDialog.MDComponent.show();
  }

  render() {
    return (
      <div>
        <Button danger onClick={this.showDialog}>Reset Device</Button>
        <Dialog ref={resetDialog => this.resetDialog = resetDialog} onAccept={this.resetDevice}>
          <Dialog.Header>Reset Device</Dialog.Header>
          <Dialog.Body>
            Resetting the device means ... ...
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
            <Dialog.FooterButton accept={true}>Reset Device</Dialog.FooterButton>
          </Dialog.Footer>
        </Dialog>
        <WaitDialog
          active={this.state.isConfirming}
          title="Reset Device"
        />
      </div>
    );
  }
}
