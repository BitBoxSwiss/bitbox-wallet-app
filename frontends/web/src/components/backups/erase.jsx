import { Component } from 'preact';
import { Button } from '../forms';
import { apiPost } from '../../utils/request';
import Dialog from '../dialog/dialog';


export default class Erase extends Component {
    state = {
        activeDialog: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
            this.abort();
        }
    }

    abort = () => {
        this.setState({
            activeDialog: false,
        });
    }

    erase = () => {
        const filename = this.props.selectedBackup;
        if (!filename) return;
        apiPost('devices/' + this.props.deviceID + '/backups/erase', { filename }).then(() => {
            this.setState({ activeDialog: false });
            this.props.onErase();
        });
    }

    render({
        selectedBackup,
    }, {
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onClick={() => this.setState({ activeDialog: true })}>
                    Erase
                </Button>
                {
                    activeDialog && (
                        <Dialog title={`Erase ${selectedBackup}`}>
                            <p>Do you really want to erase {selectedBackup}?</p>
                            <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                <Button secondary onClick={this.abort}>Abort</Button>
                                <Button danger onClick={this.erase}>Erase</Button>
                            </div>
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
