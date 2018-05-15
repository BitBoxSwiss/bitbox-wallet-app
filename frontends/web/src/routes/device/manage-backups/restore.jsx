import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../components/forms';
import Confirm from '../../../components/confirm/confirm';
import { PasswordRepeatInput } from '../../../components/password';
import { apiPost } from '../../../utils/request';

@translate()
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
        });
        apiPost('devices/' + this.props.deviceID + '/backups/restore', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(data => {
            if (!data.didRestore) this.props.displayError(data.errorMessage);
            if (this.passwordInput) this.passwordInput.clear();
            this.setState({
                isConfirming: false,
                activeDialog: false,
            });
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    render({
        t,
        selectedBackup,
    }, {
        password,
        isConfirming,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onclick={() => this.setState({ activeDialog: true })}>
                    {t('backup.restore')}
                </Button>
                { activeDialog ? (
                    <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                        <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                            <h3 class="modalHeader">Restore {selectedBackup}</h3>
                            <div class="modalContent">
                                <Confirm
                                    active={isConfirming}
                                    title="Restore Backup">
                                    <form onSubmit={this.restore}>
                                        <PasswordRepeatInput
                                            label="Password"
                                            ref={ref => this.passwordInput = ref}
                                            helptext="Password when backup was created"
                                            onValidPassword={this.setValidPassword}
                                        />
                                        <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                            <Button secondary onClick={() => this.setState({ activeDialog: false })}>Abort</Button>
                                            <Button type="submit" danger disabled={!this.validate()}>Restore</Button>
                                        </div>
                                    </form>
                                </Confirm>
                            </div>
                        </div>
                    </div>
                ) : null }
            </span>
        );
    }
}
