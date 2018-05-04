import { Component } from 'preact';
import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';
import { PasswordRepeatInput } from '../../components/password';
import { Button } from '../../components/forms';
import { BitBox } from '../../components/icon/logo';
import LanguageSwitcher from '../settings/components/language-switch';
import style from '../../components/app.css';

@translate()
export default class Initialize extends Component {
    stateEnum = Object.freeze({
        DEFAULT: 'default',
        WAITING: 'waiting',
        ERROR: 'error'
    })

    constructor(props) {
        super(props);
        this.state = {
            password: null,
            state: this.stateEnum.DEFAULT,
            errorCode: null,
            errorMessage: ''
        };
    }

    handleSubmit = event => {
        event.preventDefault();
        if (!this.state.password) {
            return;
        }
        this.setState({
            state: this.stateEnum.DEFAULT,
            error: ''
        });
        this.setState({ state: this.stateEnum.WAITING });
        apiPost('devices/' + this.props.deviceID + '/set-password', { password: this.state.password }).then(data => {
            if (!data.success) {
                if (data.code) {
                    this.setState({ errorCode: data.code });
                }
                this.setState({ state: this.stateEnum.ERROR, errorMessage: data.errorMessage });
            }
            if (this.passwordInput) {
                this.passwordInput.clear();
            }
        });
    };

    setValidPassword = password => {
        this.setState({ password });
    }

    render({ t }, state) {
        const FormSubmissionState = props => {
            switch (props.state) {
            case this.stateEnum.DEFAULT:
                break;
            case this.stateEnum.WAITING:
                return (
                    <div>Setting PIN…</div>
                );
            case this.stateEnum.ERROR:
                return (
                    <div>
                        {t(`dbb.error.${props.errorCode}`, {
                            defaultValue: props.errorMessage
                        })}
                    </div>
                );
            }
            return null;
        };

        return (
            <div className={style.container}>
                {BitBox}
                <div className={style.content}>
                    <p>Please set a PIN to interact with your device</p>
                    <form onsubmit={this.handleSubmit}>
                        <PasswordRepeatInput
                            pattern="^[0-9]+$"
                            title="Only Numbers are allowed"
                            label="PIN"
                            ref={ref => this.passwordInput = ref}
                            disabled={state.state === this.stateEnum.WAITING}
                            onValidPassword={this.setValidPassword}
                        />
                        <div>
                            <Button
                                type="submit"
                                secondary={true}
                                disabled={!state.password || state.state === this.stateEnum.WAITING}
                            >Set PIN</Button>
                        </div>
                        <FormSubmissionState {...state} />
                    </form>
                    <LanguageSwitcher />
                </div>
            </div>
        );
    }
}
