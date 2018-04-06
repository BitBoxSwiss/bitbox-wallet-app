import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import WaitDialog from '../../../components/wait-dialog/wait-dialog';

import { apiGet, apiPost } from '../../../utils/request';


export default class UpgradeFirmware extends Component {
    constructor(props) {
        super(props);
        this.state = {
            unlocked: false,
            currentVersion: '',
            newVersion: ''
        };
    }

    upgradeFirmware = () => {
        this.waitDialog.MDComponent.show();
        apiPost('device/unlock-bootloader').then(() => {
            this.waitDialog.MDComponent.close();
            this.setState({ unlocked: true });
            this.waitDialog.MDComponent.show();
        }).catch(e => {
            this.waitDialog.MDComponent.close();
        });
    };

    componentDidMount() {
        apiGet('device/info').then(({ version }) => {
            this.setState({ currentVersion: version });
        });
        apiGet('device/bundled-firmware-version').then(version => {
            this.setState({ newVersion: version });
        });
    }

    render({}, { unlocked, currentVersion, newVersion }) {
        let dialogText = <p>To upgrade from {currentVersion} to {newVersion}, please do a long touch.</p>;
        if (unlocked) {
            dialogText = (<p>
                The bootloader is unlocked. To continue, please replug the device and tap the touch button when the LED lights up.
            </p>);
        }
        return (
            <div>
                <Button
                    primary={true}
                    raised={true}
                    onClick={() => { this.dialog.MDComponent.show(); }}
                >Upgrade Firmware</Button>
                <Dialog ref={dialog => { this.dialog = dialog; }} onAccept={this.upgradeFirmware}>
                    <Dialog.Header>Upgrade Firmware</Dialog.Header>
                    <Dialog.Body>
                      Do you want to Upgrade the Firmware from version {currentVersion} to {newVersion}?
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
                        <Dialog.FooterButton accept={true}>Upgrade</Dialog.FooterButton>
                    </Dialog.Footer>
                </Dialog>
                <WaitDialog ref={waitDialog => { this.waitDialog = waitDialog; }}>
                    <WaitDialog.Header>Upgrade Firmware</WaitDialog.Header>
                    <WaitDialog.Body>
                        { dialogText }
                    </WaitDialog.Body>
                </WaitDialog>
            </div>
        );
    }
}
