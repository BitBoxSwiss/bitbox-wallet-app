import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import InnerHTMLHelper from '../../../../utils/innerHTML';


@translate()
export default class HiddenWallet extends Component {
    state = {
        password: null,
        pin: null,
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
        return this.state.password && this.state.pin;
    }

    createHiddenWallet = event => {
        event.preventDefault();
        if (!this.validate()) return;
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/set-hidden-password', {
            pin: this.state.pin,
            backupPassword: this.state.password,
        }).catch(() => {}).then(({ success, didCreate, errorMessage }) => {
            this.abort();
            if (success) {
                if (didCreate) {
                    /* eslint no-alert: 0 */
                    alert(this.props.t('hiddenWallet.success'));
                }
            } else {
                alert(errorMessage);
            }
        });
    }

    setValidPassword = password => {
        this.setState({ password });
    }

    setValidPIN = pin => {
        this.setState({ pin });
    }

    render({
        t,
        disabled,
    }, {
        password,
        isConfirming,
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    primary
                    disabled={disabled}
                    onclick={() => this.setState({ activeDialog: true })}>
                    {t('button.hiddenwallet')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('button.hiddenwallet')}>
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info1HTML')} />
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info2HTML')} />
                            <InnerHTMLHelper tagName="p" html={t('hiddenWallet.info3HTML')} />

                            <form onSubmit={this.createHiddenWallet}>
                                <PasswordRepeatInput
                                    idPrefix="pin"
                                    pattern="^[0-9]+$"
                                    title={t('initialize.input.invalid')}
                                    label={t('hiddenWallet.pinLabel')}
                                    repeatLabel={t('hiddenWallet.pinRepeatLabel')}
                                    repeatPlaceholder={t('hiddenWallet.pinRepeatPlaceholder')}
                                    ref={ref => this.pinInput = ref}
                                    onValidPassword={this.setValidPIN} />
                                <PasswordRepeatInput
                                    idPrefix="password"
                                    ref={ref => this.passwordInput = ref}
                                    label={t('hiddenWallet.passwordLabel')}
                                    repeatPlaceholder={t('hiddenWallet.passwordPlaceholder')}
                                    onValidPassword={this.setValidPassword}
                                />
                                <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                    <Button secondary onClick={this.abort} disabled={isConfirming}>
                                        {t('button.abort')}
                                    </Button>
                                    <Button type="submit" danger disabled={!this.validate() || isConfirming}>
                                        {t('button.hiddenwallet')}
                                    </Button>
                                </div>
                            </form>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('button.hiddenwallet')} />
                    )
                }
            </span>
        );
    }
}
