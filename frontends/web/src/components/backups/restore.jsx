import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button } from '../forms';
import Dialog from '../dialog/dialog';
import WaitDialog from '../wait-dialog/wait-dialog';
import Spinner from '../spinner/Spinner';
import { PasswordRepeatInput } from '../password';
import { apiPost } from '../../utils/request';

@translate()
export default class Restore extends Component {
    state = {
        password: null,
        isConfirming: false,
        activeDialog: false,
        isLoading: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        const {
            isConfirming,
            isLoading,
        } = this.state;
        if (e.keyCode === 27 && !isConfirming && !isLoading) {
            this.abort();
        } else {
            return;
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

    restore = event => {
        event.preventDefault();
        if (!this.validate()) return;
        if (this.props.requireConfirmation) {
            this.setState({
                activeDialog: false,
                isConfirming: true,
            });
        } else {
            this.setState({
                activeDialog: false,
                isLoading: true,
            });
        }
        apiPost('devices/' + this.props.deviceID + '/backups/restore', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(({ didRestore, errorMessage }) => {
            this.abort();
            if (didRestore) {
                route('/', true);
            } else {
                this.props.displayError(errorMessage);
            }
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    render({
        t,
        selectedBackup,
        requireConfirmation,
    }, {
        password,
        isConfirming,
        activeDialog,
        isLoading,
    }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onclick={() => this.setState({ activeDialog: true })}>
                    {t('button.restore')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('backup.restore.title')}>
                            <form onSubmit={this.restore}>
                                <PasswordRepeatInput
                                    ref={ref => this.passwordInput = ref}
                                    label={t('backup.restore.password.label')}
                                    placeholder={t('backup.restore.password.placeholder')}
                                    showLabel={t('backup.restore.password.showLabel')}
                                    onValidPassword={this.setValidPassword} />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort} disabled={isConfirming}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.restore')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    (isConfirming && requireConfirmation) && (
                        <WaitDialog title={t('backup.restore.confirmTitle')} />
                    )
                }
                {
                    isLoading && (
                        <Spinner text={t('backup.restore.restoring')} />
                    )
                }
            </span>
        );
    }
}
