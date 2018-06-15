import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiPost } from '../../utils/request';
import Backups from '../../components/backups/backups';
import { PasswordRepeatInput } from '../../components/password';
import { Button, Input, Checkbox } from '../../components/forms';
import Message from '../../components/message/message';
import { BitBox } from '../../components/icon/logo';
import { Guide } from '../../components/guide/guide';
import Footer from '../../components/footer/footer';
import Spinner from '../../components/spinner/Spinner';
import style from './device.css';

const stateEnum = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error',
});

@translate()
export default class Seed extends Component {
    state = {
        status: stateEnum.DEFAULT,
        walletName: '',
        backupPassword: '',
        error: '',
        fromBackup: false,
        agreements: {
            password_change: false,
            password_required: false,
            funds_access: false,
        },
    }

    validate = () => {
        if (!this.walletNameInput || !this.walletNameInput.validity.valid || !this.validAgreements()) {
            return false;
        }
        return this.state.backupPassword && this.state.walletName !== '';
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    }

    handleSubmit = event => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.setState({
            status: stateEnum.WAITING,
            error: '',
        });
        apiPost('devices/' + this.props.deviceID + '/create-wallet', {
            walletName: this.state.walletName,
            backupPassword: this.state.backupPassword
        }).then(data => {
            if (!data.success) {
                this.displayError(data.errorMessage);
            }
            if (this.backupPasswordInput) {
                this.backupPasswordInput.clear();
            }
            this.setState({ backupPassword: '' });
        });
    }

    displayError = error => {
        this.setState({
            status: stateEnum.ERROR,
            error,
        });
    }

    setValidBackupPassword = backupPassword => {
        this.setState({ backupPassword });
    }

    validAgreements = () => {
        const { agreements }= this.state;
        const invalid = Object.keys(agreements).map(agr => agreements[agr]).includes(false);
        return !invalid;
    }

    handleAgreementChange = ({ target }) => {
        let { agreements } = this.state;
        agreements[target.id] = target.checked;
        this.setState({ agreements });
    }

    render({
        t,
        deviceID,
        guide,
    }, {
        status,
        walletName,
        error,
        fromBackup,
        agreements,
    }) {
        const errorMessage = (
            <Message type={status === 'error' && 'error'}>
                {status === stateEnum.ERROR ? error : null}
            </Message>
        );

        const content = fromBackup ? (
            <Backups
                showCreate={false}
                displayError={this.displayError}
                deviceID={deviceID}
                requireConfirmation={false}>
                <Button
                    type="button"
                    transparent
                    onClick={() => this.setState({ fromBackup: false })}>
                    {t('seed.backToCreate')}
                </Button>
            </Backups>
        ) : (
            <form onSubmit={this.handleSubmit}>
                <div>
                    <Input
                        pattern="^[0-9a-zA-Z-_.]{1,31}$"
                        autoFocus
                        id="walletName"
                        label={t('seed.walletName.label')}
                        placeholder={t('seed.walletName.placeholder')}
                        disabled={status === stateEnum.WAITING}
                        onInput={this.handleFormChange}
                        getRef={ref => this.walletNameInput = ref}
                        value={walletName}
                    />
                    <PasswordRepeatInput
                        label={t('seed.password.label')}
                        ref={ref => this.backupPasswordInput = ref}
                        disabled={status === stateEnum.WAITING}
                        onValidPassword={this.setValidBackupPassword}
                    />
                </div>
                <div class={style.agreements}>
                    <p>{t('seed.description')}</p>
                    <Checkbox
                        id="password_change"
                        label={t('seed.agreements.password_change')}
                        checked={agreements.password_change}
                        onChange={this.handleAgreementChange}
                    />
                    <Checkbox
                        id="password_required"
                        label={t('seed.agreements.password_required')}
                        checked={agreements.password_required}
                        onChange={this.handleAgreementChange}
                    />
                    <Checkbox
                        id="funds_access"
                        label={t('seed.agreements.funds_access')}
                        checked={agreements.funds_access}
                        onChange={this.handleAgreementChange}
                    />
                </div>
                <div>
                    <Button
                        type="submit"
                        primary
                        disabled={!this.validate() || status === stateEnum.WAITING}>
                        {t('seed.create')}
                    </Button>
                    <Button
                        type="button"
                        transparent
                        onClick={() => this.setState({ fromBackup: true, error: '' })}>
                        {t('seed.backup')}
                    </Button>
                </div>
            </form>
        );

        return (
            <div class="contentWithGuide">
                <div className={[style.container, style.scrollable].join(' ')}>
                    <BitBox />
                    <div className={style.content}>
                        {errorMessage}
                        {content}
                        <hr />
                        <Footer />
                    </div>
                    {
                        status === stateEnum.WAITING && (
                            <Spinner />
                        )
                    }
                </div>
                <Guide guide={guide} screen="seed" />
            </div>
        );
    }
}
