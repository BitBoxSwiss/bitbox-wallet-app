import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../forms';
import Dialog from '../dialog/dialog';
import { PasswordSingleInput } from '../password';
import { apiPost } from '../../utils/request';

@translate()
export default class Check extends Component {
    state = {
        password: null,
        activeDialog: false,
        message: null,
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
            activeDialog: false,
            message: null,
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

    check = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({ message: this.props.t('backup.check.checking') });

        apiPost('devices/' + this.props.deviceID + '/backups/check', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(({ success, errorMessage }) => {
            if (success) {
                this.setState({ message: this.props.t('backup.check.success') });
            } else if (errorMessage) {
                this.setState({ message: errorMessage });
            }
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
        activeDialog,
        message,
    }) {
        return (
            <span>
                <Button
                    secondary
                    disabled={selectedBackup === null}
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.check')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('backup.check.title')}>
                            { message ? (
                                <div>
                                    <p style="min-height: 3rem;">{message}</p>
                                    <div className={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                        <Button primary onClick={this.abort}>
                                            {t('button.back')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={this.check}>
                                    <PasswordSingleInput
                                        ref={ref => this.passwordInput = ref}
                                        label={t('backup.check.password.label')}
                                        placeholder={t('backup.check.password.placeholder')}
                                        showLabel={t('backup.check.password.showLabel')}
                                        onValidPassword={this.setValidPassword} />
                                    <div className={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                        <Button secondary onClick={this.abort}>
                                            {t('button.back')}
                                        </Button>
                                        <Button type="submit" primary disabled={!this.validate()}>
                                            {t('button.check')}
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
