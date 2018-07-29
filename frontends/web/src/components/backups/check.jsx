import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import i18n from '../../i18n/i18n';
import { Button, Checkbox } from '../forms';
import Dialog from '../dialog/dialog';
import Spinner from '../spinner/Spinner';
import { PasswordSingleInput } from '../password';
import { apiPost } from '../../utils/request';
import style from './backups.css';

@translate()
export default class Check extends Component {
    state = {
        password: null,
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

    check = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            activeDialog: false,
        });

        apiPost('devices/' + this.props.deviceID + '/backups/check', {
            password: this.state.password,
            filename: this.props.selectedBackup,
        }).catch(() => {}).then(({ success, errorMessage }) => {
            if (success) {
                alert(i18n.t('backup.check.success'))
            } else if (errorMessage) {
                alert(errorMessage);
            }
            this.abort();
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
                            <form onSubmit={this.check}>
                                <PasswordSingleInput
                                    ref={ref => this.passwordInput = ref}
                                    label={t('backup.check.password.label')}
                                    placeholder={t('backup.check.password.placeholder')}
                                    showLabel={t('backup.check.password.showLabel')}
                                    onValidPassword={this.setValidPassword} />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" primary disabled={!this.validate()}>
                                        {t('button.check')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
