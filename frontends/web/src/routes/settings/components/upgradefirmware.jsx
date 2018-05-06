import { Component } from 'preact';

import { Button } from '../../../components/forms';
import Dialog from 'preact-material-components/Dialog';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { apiGet, apiPost } from '../../../utils/request';
import 'preact-material-components/Dialog/style.css';


export default class UpgradeFirmware extends Component {
  state = {
    unlocked: false,
    currentVersion: '',
    newVersion: '',
    isConfirming: false,
  }

  upgradeFirmware = () => {
    this.setState({ isConfirming: true });
    apiPost('devices/' + this.props.deviceID + '/unlock-bootloader').then(() => {
      this.setState({ unlocked: true });
    }).catch(e => {
      this.setState({ isConfirming: false });
    });
  };

  componentDidMount() {
    apiGet('devices/' + this.props.deviceID + '/info').then(({ version }) => {
      this.setState({ currentVersion: version });
    });
    apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
      this.setState({ newVersion: version });
    });
  }

  showDialog = () => {
    this.dialog.MDComponent.show();
  }

  render({}, { unlocked, currentVersion, newVersion }) {
    let dialogText = <p>To upgrade from {currentVersion} to {newVersion}, please do a long touch.</p>;
    if (unlocked) {
      dialogText = (
        <p>The bootloader is unlocked. To continue, please replug the device and tap the touch button when the LED lights up.</p>
      );
    }
    return (
      <div>
        <Button
          secondary
          onClick={this.showDialog}>
          Upgrade Firmware
        </Button>
        <Dialog ref={dialog => this.dialog = dialog} onAccept={this.upgradeFirmware}>
          <Dialog.Header>Upgrade Firmware</Dialog.Header>
          <Dialog.Body>
            Do you want to Upgrade the Firmware from version {currentVersion} to {newVersion}?
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
            <Dialog.FooterButton accept={true}>Upgrade</Dialog.FooterButton>
          </Dialog.Footer>
        </Dialog>
        <WaitDialog
          active={this.state.isConfirming}
          title="Upgrade Firmware">
          {dialogText}
        </WaitDialog>
      </div>
    );
  }
}
