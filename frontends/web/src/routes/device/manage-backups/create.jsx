import { Component } from 'preact';
import { Button, Input } from '../../../components/forms';
import { PasswordInput } from '../../../components/password';
import { apiPost } from '../../../utils/request';

export default class Create extends Component {
    state = {
        waiting: false,
        backupName: '',
        recoveryPassword: '',
        activeDialog: false,
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return !this.waiting && this.state.backupName !== '';
    }

    create = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({ waiting: true });
        apiPost('devices/' + this.props.deviceID + '/backups/create', {
            backupName: this.state.backupName,
            recoveryPassword: this.state.recoveryPassword,
        }).then(() => this.props.onCreate()).catch(() => {}).then(() => {
            this.setState({
                waiting: false,
                backupName: '',
                recoveryPassword: '',
                activeDialog: false,
            });
        });
    }

    render({}, {
        waiting,
        recoveryPassword,
        backupName,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    onclick={() => this.setState({ activeDialog: true })}>
                    Create
                </Button>
                <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                    <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                        <h3 class="modalHeader">Create Backup</h3>
                        <div class="modalContent">
                            <Input
                                autoFocus
                                autoComplete="off"
                                ref={pwf => this.pwf = pwf}
                                id="backupName"
                                label="Backup Name"
                                placeholder="Please name the backup"
                                onInput={this.handleFormChange}
                                value={backupName}
                            />
                            <PasswordInput
                                ref={ref => this.passwordInput = ref}
                                helptext="Please enter the same password as when the wallet was created."
                                helptextPersistent={true}
                                id="recoveryPassword"
                                label="Password"
                                placeholder="Please enter your password"
                                onInput={this.handleFormChange}
                                value={recoveryPassword}
                            />
                            <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                                <Button primary disabled={waiting || !this.validate()} onClick={this.create}>Create</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </span>
        );
    }
}
