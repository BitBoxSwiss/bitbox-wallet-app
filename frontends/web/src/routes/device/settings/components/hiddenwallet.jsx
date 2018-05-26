import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import Spinner from '../../../../components/spinner/Spinner';
import Confirm from '../../../../components/confirm/confirm';
import { PasswordRepeatInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';

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
        const {
            isConfirming,
        } = this.state;
        if (e.keyCode === 27 && !isConfirming) {
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
                    alert("Hidden wallet created successfully. Replug your BitBox to unlock it.");
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
        disabled
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
                        <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                            <div class={['modal', activeDialog ? 'active' : ''].join(' ')}>
                                <h3 class="modalHeader">{t('button.hiddenwallet')}</h3>
                                <div class="modalContent">
                                    <p>A hidden wallet is created based on the <strong>hidden backup password</strong>.</p>
                                    <p>The <strong>hidden PIN</strong> defines the PIN to unlock the hidden wallet. Use your original PIN to unlock your original wallet.</p>
                                    <p>Your backup of the current wallet can be used to recover your hidden wallet using the hidden wallet password.</p>
                                    <form onSubmit={this.createHiddenWallet}>
                                        <PasswordRepeatInput
                                            idPrefix="pin"
                                            pattern="^[0-9]+$"
                                            title={t('initialize.invalid')}
                                            label="Hidden PIN"
                                            repeatLabel="Repeat hidden PIN"
                                            repeatPlaceholder="Please confirm hidden PIN"
                                            ref={ref => this.pinInput = ref}
                                            onValidPassword={this.setValidPIN} />
                                        <PasswordRepeatInput
                                            idPrefix="password"
                                            ref={ref => this.passwordInput = ref}
                                            label="Hidden backup password"
                                            repeatPlaceholder="Please confirm hidden backup password"
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
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    (isConfirming) && (
                        <WaitDialog title={t('button.hiddenwallet')} />
                    )
                }
            </span>
        );
    }
}
