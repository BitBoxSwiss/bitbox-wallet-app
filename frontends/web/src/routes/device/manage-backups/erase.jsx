import { Component } from 'preact';

import { Button } from '../../../components/forms';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import { apiPost } from '../../../utils/request';

export default class Erase extends Component {
    erase = () => {
        const filename = this.props.selectedBackup;
        if (!filename) {
            return;
        }
        apiPost('devices/' + this.props.deviceID + '/backups/erase', { filename }).then(() => {
            this.props.onErase();
        });
    }

    showDialog = () => {
        this.confirmDialog.MDComponent.show();
    }

    render({ selectedBackup }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onClick={this.showDialog}
                >Erase</Button>
                <Dialog
                    ref={confirmDialog => this.confirmDialog = confirmDialog}
                    onAccept={this.erase}
                >
                    <Dialog.Header>Erase {selectedBackup}</Dialog.Header>
                    <Dialog.Body>
                      Do you really want to erase {selectedBackup}?
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
                        <Dialog.FooterButton accept={true}>Erase</Dialog.FooterButton>
                    </Dialog.Footer>
                </Dialog>
            </span>
        );
    }
}
