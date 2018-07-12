import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordInput, PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';


@translate()
export default class HiddenWallet extends Component {
    state = {
        oldPIN: null,
        newPIN: null,
        errorCode: null,
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
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.abort();
        }
    }

    abort = () => {
        this.setState({
            oldPIN: null,
            newPIN: null,
            isConfirming: false,
            activeDialog: false,
        });
        if (this.newPINInput) {
            this.newPINInput.clear();
        }
    }

    validate = () => {
        return this.state.newPIN && this.state.oldPIN;
    }

    changePin = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/change-password', {
            oldPIN: this.state.oldPIN,
            newPIN: this.state.newPIN,
        }).catch(() => {}).then(data => {
            this.abort();

            if (!data.success) {
                alert(data.errorMessage); // eslint-disable-line no-alert
            }
        });
    }

    setValidOldPIN = e => {
        this.setState({ oldPIN: e.target.value });
    }

    setValidNewPIN = newPIN => {
        this.setState({ newPIN });
    }

    render({
        t,
        disabled,
    }, {
        oldPIN,
        isConfirming,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    disabled={disabled}
                    onclick={() => this.setState({ activeDialog: true })}>
                    {t('button.changepin')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('button.changepin')}>
                            <form onSubmit={this.changePin}>
                                {t('changePin.oldTitle') && <h4>{t('changePin.oldTitle')}</h4>}
                                <PasswordInput
                                    idPrefix="oldPIN"
                                    label={t('changePin.oldLabel')}
                                    title={t('initialize.input.invalid')}
                                    placeholder={t('changePin.oldPlaceholder')}
                                    value={oldPIN}
                                    onChange={this.setValidOldPIN} />
                                {t('changePin.newTitle') && <h4>{t('changePin.newTitle')}</h4>}
                                <PasswordRepeatInput
                                    idPrefix="newPIN"
                                    pattern="^.{4,}$"
                                    title={t('initialize.input.invalid')}
                                    label={t('initialize.input.label')}
                                    repeatLabel={t('initialize.input.labelRepeat')}
                                    repeatPlaceholder={t('initialize.input.placeholderRepeat')}
                                    ref={ref => this.newPINInput = ref}
                                    onValidPassword={this.setValidNewPIN} />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort} disabled={isConfirming}>
                                        {t('button.back')}
                                    </Button>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.changepin')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('button.changepin')} />
                    )
                }
            </span>
        );
    }
}
