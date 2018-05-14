import { Component } from 'preact';
import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import Message from '../../components/message/message';
import { BitBox } from '../../components/icon/logo';
import Footer from '../../components/footer/footer';
import style from '../../components/app.css';

const stateEnum = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error'
});

@translate()
export default class Unlock extends Component {
    state = {
        state: stateEnum.DEFAULT,
        errorMessage: '',
        errorCode: null,
        remainingAttempts: null,
        needsLongTouch: false,
        password: ''
    }

    componentDidMount() {
        this.focus();
    }

    componentDidUpdate() {
        this.focus();
    }

    focus() {
        if (this.passwordInput) {
            this.passwordInput.focus();
        }
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
            state: stateEnum.WAITING
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
                this.setState({ state: stateEnum.ERROR, errorMessage: data.errorMessage });
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
        case stateEnum.DEFAULT:
            submissionState = <Message />;
            break;
        case stateEnum.WAITING:
            submissionState = <Message type="info">{t('unlock.unlocking')}</Message>;
            break;
        case stateEnum.ERROR:
            submissionState = (
                <Message type="error">
                    {t(`dbb.error.${errorCode}`, {
                        defaultValue: errorMessage,
                        remainingAttempts,
                        context: needsLongTouch ? 'touch' : 'normal'
                    })}
                </Message>
            );
        }

        return (
            <div className={style.container}>
                {BitBox}
                <div className={style.content}>
                    {submissionState}
                    {state !== stateEnum.WAITING && (
                        <form onsubmit={this.handleSubmit}>
                            <div>
                                <Input
                                    autoFocus
                                    getRef={ref => this.passwordInput = ref}
                                    id="password"
                                    type="password"
                                    label={t('unlock.input.label')}
                                    disabled={state === stateEnum.WAITING}
                                    placeholder={t('unlock.input.placeholder')}
                                    onInput={this.handleFormChange}
                                    value={password}
                                />
                            </div>
                            <div>
                                <Button
                                    primary
                                    type="submit"
                                    disabled={!this.validate() || state === stateEnum.WAITING}
                                    style={{ width: '100%' }}
                                >{t('Login')}</Button>
                            </div>
                        </form>
                    )}
                    <Footer />
                </div>
            </div>
        );
    }
}
