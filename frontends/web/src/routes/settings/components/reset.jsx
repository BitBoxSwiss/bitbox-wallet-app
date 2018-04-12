import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import WaitDialog from '../../../components/wait-dialog/wait-dialog';

import { apiPost } from '../../../utils/request';


export default class Reset extends Component {
    resetDevice = () => {
        this.waitDialog.MDComponent.show();
        apiPost('device/reset').then(() => {
            this.waitDialog.MDComponent.close();
        });
    };

    showDialog = () => {
        this.resetDialog.MDComponent.show();
    }

    render() {
        return (
            <div>
                <Button primary={true} raised={true} onClick={this.showDialog}>Reset Device</Button>
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
                <WaitDialog ref={waitDialog => this.waitDialog = waitDialog}>
                    <WaitDialog.Header>Reset Device</WaitDialog.Header>
                    <WaitDialog.Body>
                        <p>Short touch = abort</p>
                        <p>Long touch = confirm</p>
                    </WaitDialog.Body>
                </WaitDialog>
            </div>
        );
    }
}
