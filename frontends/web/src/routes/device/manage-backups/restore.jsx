import { Component } from 'preact';
import { Button } from '../../../components/forms';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { PasswordRepeatInput } from '../../../components/password';
import { apiPost } from '../../../utils/request';

export default class Restore extends Component {
    state = {
        password: null,
        isConfirming: false,
        activeDialog: false,
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    }

    validate = () => {
        return this.props.selectedBackup && this.state.password;
    }

    restore = (event) => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            isConfirming: true,
            activeDialog: false,
        });
        apiPost('devices/' + this.props.deviceID + '/backups/restore', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(data => {
            if (!data.didRestore) this.props.displayError(data.errorMessage);
            if (this.passwordInput) this.passwordInput.clear();
            this.setState({
                isConfirming: false,
            });
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    render({
        selectedBackup,
    }, {
        password,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onclick={() => this.setState({ activeDialog: true })}>
                    Restore
                </Button>
                <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                    <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                        <h3 class="modalHeader">Restore {selectedBackup}</h3>
                        <div class="modalContent">
                            <PasswordRepeatInput
                                label="Password"
                                ref={ref => this.passwordInput = ref}
                                helptext="Password when backup was created"
                                onValidPassword={this.setValidPassword}
                            />
                            <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                                <Button danger disabled={!this.validate()} onClick={this.restore}>Restore</Button>
                            </div>
                        </div>
                    </div>
                </div>
                <WaitDialog
                    active={this.state.isConfirming}
                    title="Restore Backup"
                />
            </span>
        );
    }
}
