import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import { PasswordInput } from '../../../components/password';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import { apiPost } from '../../../utils/request';

export default class Create extends Component {
    constructor(props) {
        super(props);
        this.state = {
            waiting: false,
            backupName: '',
            recoveryPassword: ''
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return !this.waiting && this.state.backupName !== '';
    }

    create = (event) => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.setState({ waiting: true });
        apiPost('devices/' + this.props.deviceID + '/backups/create', { backupName: this.state.backupName,
                recoveryPassword: this.state.recoveryPassword }).then(() => {
            this.props.onCreate();
        }).catch(() => {}).then(() => {
            this.setState({
                waiting: false,
                backupName: '',
                recoveryPassword: ''
            });
            this.confirmDialog.MDComponent.close();
        });
    }

    showDialog = () => {
        this.confirmDialog.MDComponent.show();
    }

    render({}, { waiting, recoveryPassword, backupName }) {
        return (
            <span>
                <Button
                    primary={true}
                    raised={true}
                    onclick={this.showDialog}
                >
                    Create
                </Button>
                <Dialog
                    ref={confirmDialog => this.confirmDialog = confirmDialog }
                    onAccept={this.erase}
                >
                    <Dialog.Header>Create Backup</Dialog.Header>
                    <form onSubmit={this.create}>
                        <Dialog.Body>
                            <Textfield
                                autoFocus
                                autoComplete="off"
                                ref={pwf => this.pwf = pwf}
                                id="backupName"
                                label="Backup Name"
                                helptext="Please name the backup."
                                helptextPersistent={true}
                                onInput={this.handleFormChange}
                                value={backupName}
                            />
                            <PasswordInput
                                    ref={ref => this.passwordInput = ref}
                                    helptext="Please enter the same password as when the wallet was created."
                                    helptextPersistent={true}
                                    id="recoveryPassword"
                                    onInput={this.handleFormChange}
                                    value={recoveryPassword}/>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Dialog.FooterButton
                                type="button"
                                cancel={true}
                            >
                                Abort
                            </Dialog.FooterButton>
                            <Dialog.FooterButton
                                type="submit"
                                disabled={waiting || !this.validate()}
                            >
                                Create
                            </Dialog.FooterButton>
                        </Dialog.Footer>
                    </form>
                </Dialog>
            </span>
        );
    }
}
