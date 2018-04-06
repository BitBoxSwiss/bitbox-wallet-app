import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { PasswordRepeatInput } from '../../../components/password';

import { apiPost } from '../../../utils/request';

export default class Restore extends Component {
    constructor(props) {
        super(props);
        this.state = {
            password: null
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    }

    validate = () => {
        return this.props.selectedBackup && this.state.password;
    }

    restore = (event) => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.confirmDialog.MDComponent.close();
        this.waitDialog.MDComponent.show();
        apiPost('device/backups/restore', {
            password: this.state.password,
            filename: this.props.selectedBackup
        }).catch(() => {}).then(() => {
            if (this.passwordInput) {
                this.passwordInput.clear();
            }
            this.waitDialog.MDComponent.close();
        });
    }

    render({ selectedBackup }, { password }) {
        return (
            <span>
                <Button
                    primary={true}
                    raised={true}
                    disabled={selectedBackup === null}
                    onclick={() => { this.confirmDialog.MDComponent.show(); }}
                >Restore</Button>
                <Dialog
                    ref={confirmDialog => { this.confirmDialog = confirmDialog; }}
                    onAccept={this.restore}
                >
                    <Dialog.Header>Restore {selectedBackup}</Dialog.Header>
                    <form ref={form => { this.form = form; }} onSubmit={this.restore}>
                        <Dialog.Body>
                            <div>
                                <PasswordRepeatInput
                                    ref={ref => { this.passwordInput = ref; }}
                                    helptext="Please enter the same password as when the backup was created."
                                    helptextPersistent={true}
                                    onValidPassword={password => this.setState({ password })}
                                />
                            </div>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Dialog.FooterButton
                                type="button"
                                cancel={true}>Abort</Dialog.FooterButton>
                            <Dialog.FooterButton
                                type="submit"
                                disabled={!this.validate()}
                            >Restore</Dialog.FooterButton>
                        </Dialog.Footer>
                    </form>
                </Dialog>
                <WaitDialog ref={waitDialog => { this.waitDialog = waitDialog; }}>
                    <WaitDialog.Header>Restore Backup</WaitDialog.Header>
                    <WaitDialog.Body>
                        <p>Short touch = abort</p>
                        <p>Long touch = confirm</p>
                    </WaitDialog.Body>
                </WaitDialog>
            </span>
        );
    }
}
