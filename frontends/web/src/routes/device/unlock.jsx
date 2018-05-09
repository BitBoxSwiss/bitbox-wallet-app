import { Component } from 'preact';
import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import { BitBox } from '../../components/icon/logo';
import style from '../../components/app.css';

@translate()
export default class Unlock extends Component {
    stateEnum = Object.freeze({
        DEFAULT: 'default',
        WAITING: 'waiting',
        ERROR: 'error'
    })

    constructor(props) {
        super(props);
        this.state = {
            state: this.stateEnum.DEFAULT,
            errorMessage: '',
            errorCode: null,
            remainingAttempts: null,
            needsLongTouch: false,
            password: ''
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return this.state.password !== '';
    }

    handleSubmit = event => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.setState({
            state: this.stateEnum.WAITING
        });
        apiPost('devices/' + this.props.deviceID + '/login', { password: this.state.password }).then(data => {
            if (!data.success) {
                if (data.code) {
                    this.setState({ errorCode: data.code });
                }
                if (data.remainingAttempts) {
                    this.setState({ remainingAttempts: data.remainingAttempts });
                }
                if (data.needsLongTouch) {
                    this.setState({ needsLongTouch: data.needsLongTouch });
                }
                this.setState({ state: this.stateEnum.ERROR, errorMessage: data.errorMessage });
            }
        });
        this.setState({ password: '' });
    };

    render({ t }, {
        state, password,
        errorCode, errorMessage, remainingAttempts, needsLongTouch
    }) {

        let submissionState = null;

        switch (state) {
        case this.stateEnum.DEFAULT:
            break;
        case this.stateEnum.WAITING:
            submissionState = <p>{t('dbb.unlocking')}</p>;
            break;
        case this.stateEnum.ERROR:
            submissionState = (
                <p>
                    {t(`dbb.error.${errorCode}`, {
                        defaultValue: errorMessage,
                        remainingAttempts,
                        context: needsLongTouch ? 'touch' : 'normal'
                    })}
                </p>
            );
        }

        return (
            <div className={style.container}>
                {BitBox}
                <div className={style.content}>
                    {submissionState}
                    {state !== this.stateEnum.WAITING && (
                        <form onsubmit={this.handleSubmit}>
                            <div>
                                <Input
                                    autoFocus
                                    id="password"
                                    type="password"
                                    label={t('PIN')}
                                    disabled={state === this.stateEnum.WAITING}
                                    placeholder={t('Please enter your PIN to log in')}
                                    onInput={this.handleFormChange}
                                    value={password}
                                />
                            </div>
                            <div>
                                <Button
                                    primary
                                    type="submit"
                                    disabled={!this.validate() || state === this.stateEnum.WAITING}
                                    style={{ width: '100%' }}
                                >{t('Login')}</Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    }
}
