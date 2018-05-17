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
            password: null,
            isConfirming: false,
            activeDialog: false,
        });
        if (this.passwordInput) {
            this.passwordInput.clear();
        }
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
            this.abort();
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    render({
        t,
        selectedBackup,
        requireConfirmation
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
                    {t('button.restore')}
                </Button>
                { activeDialog ? (
                    <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                        <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                            <h3 class="modalHeader">{t('backup.restore.title')} {selectedBackup}</h3>
                            <div class="modalContent">
                                <Confirm
                                    active={isConfirming && requireConfirmation}
                                    title={t('backup.restore.confirmTitle')}>
                                    <form onSubmit={this.restore}>
                                        <PasswordRepeatInput
                                            ref={ref => this.passwordInput = ref}
                                            label={t('backup.restore.password.label')}
                                            helptext={t('backup.restore.password.helptext')}
                                            onValidPassword={this.setValidPassword}
                                        />
                                        <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                            <Button secondary onClick={this.abort}>
                                                {t('button.abort')}
                                            </Button>
                                            <Button type="submit" danger disabled={!this.validate()}>
                                                {t('button.restore')}
                                            </Button>
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
