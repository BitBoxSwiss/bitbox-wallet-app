import { Component } from 'preact';

import { apiPost } from '../../utils/request';
import ManageBackups from '../../routes/device/manage-backups/manage-backups';
import { PasswordRepeatInput } from '../../components/password';
import { Button, Input } from '../../components/forms';
import { BitBox } from '../../components/icon/logo';
import style from '../../components/app.css';

export default class Seed extends Component {
    stateEnum = Object.freeze({
        DEFAULT: 'default',
        WAITING: 'waiting',
        ERROR: 'error'
    })

    constructor(props) {
        super(props);
        this.state = {
            state: this.stateEnum.DEFAULT,
            walletName: '',
            backupPassword: '',
            error: ''
        };
    }

    validate = () => {
        return this.state.backupPassword && this.state.walletName !== '';
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    handleSubmit = event => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.setState({
            state: this.stateEnum.WAITING,
            error: ''
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
    };

    displayError = (errorMessage) => {
        this.setState({ state: this.stateEnum.ERROR, error: errorMessage });
    }

    setValidBackupPassword = backupPassword => {
        this.setState({ backupPassword });
    }

    render({ deviceID }, { state, walletName, error }) {

        if (state === this.stateEnum.WAITING) {
            return (
                <div className={style.container}>
                    {BitBox}
                    <div className={style.content}>Creating wallet..</div>
                </div>
            );
        }

        return (
            <div className={style.container}>
                {BitBox}
                <div className={style.content}>
                    <form onsubmit={this.handleSubmit}>
                        { state === this.stateEnum.ERROR ? <p style="color: var(--color-error);">{error}</p> : null }
                        <div>
                            <Input
                                autoFocus
                                autoComplete="off"
                                id="walletName"
                                label="Wallet Name"
                                disabled={state === this.stateEnum.WAITING}
                                onInput={this.handleFormChange}
                                value={walletName}
                            />

                            <PasswordRepeatInput
                                label="Password"
                                ref={ref => this.backupPasswordInput = ref}
                                disabled={state.state === this.stateEnum.WAITING}
                                onValidPassword={this.setValidBackupPassword}
                            />
                        </div>
                        <p>TODO: Explain that the Password is used for Master Key
                        Derivation (?) and can NOT be changed nomore never ever
                        (with simpler or nicer words)</p>
                        <div>
                            <Button
                                type="submit"
                                primary
                                disabled={!this.validate() || state === this.stateEnum.WAITING}
                            >Create Wallet</Button>
                        </div>
                    </form>
                    <p>-- OR --</p>
                    <ManageBackups showCreate={false} displayError={this.displayError} deviceID={deviceID} />
                </div>
            </div>
        );
    }
}
