import { Component } from 'preact';
import { route } from 'preact-router';
import { Button } from '../../../../components/forms';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';
import 'preact-material-components/Dialog/style.css';


export default class DeviveLock extends Component {
    state = {
        isConfirming: false,
        activeDialog: false,
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/lock').then(({ didLock }) => {
            this.setState({
                isConfirming: false,
            });
        });
    };

    render({}, {
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <Button danger onClick={() => this.setState({ activeDialog: true })}>Enable Full 2FA</Button>
                <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                    <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                        <h3 class="modalHeader">Enable Full 2FA</h3>
                        <p>Do you have a backup?</p>
                        <p>Is mobile app verification working?</p>
                        <p>2FA mode DISABLES backups and mobile app pairing. The device must be ERASED to exit 2FA mode!</p>
                        <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                            <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                            <Button danger onClick={this.resetDevice}>Enable Full 2FA</Button>
                        </div>
                    </div>
                </div>
                {
                    isConfirming && (
                        <WaitDialog title="Enable full 2FA" />
                    )
                }
            </div>
        );
    }
}
