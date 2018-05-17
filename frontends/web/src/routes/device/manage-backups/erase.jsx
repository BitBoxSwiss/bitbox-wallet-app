import { Component } from 'preact';
import { Button } from '../../../components/forms';
import { apiPost } from '../../../utils/request';


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
                { activeDialog ? (
                    <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                        <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                            <h3 class="modalHeader">Erase {selectedBackup}</h3>
                            <div class="modalContent">
                                Do you really want to erase {selectedBackup}?
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort}>Abort</Button>
                                    <Button danger onClick={this.erase}>Erase</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null }
            </span>
        );
    }
}
