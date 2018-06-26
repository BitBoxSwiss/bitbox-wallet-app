import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button, Input } from '../forms';
import { PasswordInput } from '../password';
import { apiPost } from '../../utils/request';
import Dialog from '../dialog/dialog';

@translate()
export default class Create extends Component {
    state = {
        waiting: false,
        backupName: '',
        recoveryPassword: '',
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
            waiting: false,
            backupName: '',
            recoveryPassword: '',
            activeDialog: false,
        });
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
        }).then(data => {
            this.abort();
            if (!data.success) {
                alert(data.errorMessage);
            } else {
                this.props.onCreate();
            }
        });
    }

    render({ t }, {
        waiting,
        recoveryPassword,
        backupName,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.create')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('backup.create.title')}>
                            <form onSubmit={this.create}>
                                <Input
                                    autoFocus
                                    autoComplete="off"
                                    ref={pwf => this.pwf = pwf}
                                    id="backupName"
                                    label={t('backup.create.name.label')}
                                    placeholder={t('backup.create.name.placeholder')}
                                    onInput={this.handleFormChange}
                                    value={backupName} />
                                <PasswordInput
                                    ref={ref => this.passwordInput = ref}
                                    id="recoveryPassword"
                                    label={t('backup.create.password.label')}
                                    placeholder={t('backup.create.password.placeholder')}
                                    onInput={this.handleFormChange}
                                    value={recoveryPassword} />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" primary disabled={waiting || !this.validate()}>
                                        {t('button.create')}
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
