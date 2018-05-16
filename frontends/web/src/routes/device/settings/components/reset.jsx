import { Component } from 'preact';
import { Button } from '../../../../components/forms';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';
import 'preact-material-components/Dialog/style.css';


export default class Reset extends Component {
    state = {
        isConfirming: false,
        activeDialog: false,
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/reset').then(() => {
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
                <Button danger onClick={() => this.setState({ activeDialog: true })}>Reset Device</Button>
                <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                    <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                        <h3 class="modalHeader">Reset Device</h3>
                        <p>Resetting the device means ... ...</p>
                        <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                            <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                            <Button danger onClick={this.resetDevice}>Reset Device</Button>
                        </div>
                    </div>
                </div>
                <WaitDialog
                    active={isConfirming}
                    title="Reset Device"
                />
            </div>
        );
    }
}
