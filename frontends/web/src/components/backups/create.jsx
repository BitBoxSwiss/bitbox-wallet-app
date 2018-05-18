import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button, Input } from '../forms';
import { PasswordInput } from '../password';
import { apiPost } from '../../utils/request';

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
        }).then(() => this.props.onCreate()).catch(() => {}).then(() => {
            this.abort();
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
                { activeDialog ? (
                    <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                        <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                            <h3 class="modalHeader">{t('backup.create.title')}</h3>
                            <div class="modalContent">
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
                                        helptext="Please enter the same password as when the wallet was created."
                                        helptextPersistent={true}
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
                            </div>
                        </div>
                    </div>
                ) : null }
            </span>
        );
    }
}
