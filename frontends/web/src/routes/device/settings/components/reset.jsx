import { Component } from 'preact';
import { route } from 'preact-router';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';


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
        apiPost('devices/' + this.props.deviceID + '/reset').then(({ didReset }) => {
            this.setState({
                isConfirming: false,
            });
            if (didReset) {
                route('/', true);
            }
        });
    };

    render({}, {
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <Button danger onClick={() => this.setState({ activeDialog: true })}>Reset Device</Button>
                {
                    activeDialog && (
                        <Dialog title="Reset Device">
                            <p>Resetting the device means ... ...</p>
                            <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                                <Button danger onClick={this.resetDevice}>Reset Device</Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog
                            active={isConfirming}
                            title="Reset Device"
                        />
                    )
                }
            </div>
        );
    }
}
