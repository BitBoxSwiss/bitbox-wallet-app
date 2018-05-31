import { Component } from 'preact';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiGet, apiPost } from '../../../../utils/request';
import componentStyle from '../../../../components/style.css';


export default class UpgradeFirmware extends Component {
    state = {
        unlocked: false,
        newVersion: '',
        isConfirming: false,
        activeDialog: false,
    }

    upgradeFirmware = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/unlock-bootloader').then((success) => {
            this.setState({
                unlocked: success,
                isConfirming: success,
            });
        }).catch(e => {
            this.setState({
                isConfirming: false,
            });
        });
    };

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
            this.setState({ newVersion: version.replace('v', '') });
        });
    }

    render({
        currentVersion,
    }, {
        unlocked,
        newVersion,
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <Button
                    primary
                    onClick={() => this.setState({ activeDialog: true })}>
                    Upgrade Firmware
                    {
                        newVersion !== currentVersion && (
                            <div class={componentStyle.badge}></div>
                        )
                    }
                </Button>
                {
                    activeDialog && (
                        <Dialog title="Upgrade Firmware">
                            <p>Do you want to Upgrade the Firmware from version {currentVersion} to {newVersion}?</p>
                            <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button danger onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                                <Button primary onClick={this.upgradeFirmware}>Upgrade</Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title="Upgrade Firmware" includeDefault>
                            {
                                unlocked ? (
                                    <p>The bootloader is unlocked. To continue, please replug the device and tap the touch button when the LED lights up.</p>
                                ) : (
                                    <p>To upgrade from {currentVersion} to {newVersion}, please do a long touch.</p>
                                )
                            }
                        </WaitDialog>
                    )
                }
            </div>
        );
    }
}
