import { Component } from 'preact';
import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import Message from '../../components/message/message';
import { BitBox, Shift } from '../../components/icon/logo';
import { Guide, Entry } from '../../components/guide/guide';
import Footer from '../../components/footer/footer';
import style from './device.css';

const stateEnum = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error'
});

@translate()
export default class Unlock extends Component {
    state = {
        status: stateEnum.DEFAULT,
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
            status: stateEnum.WAITING
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
                this.setState({ status: stateEnum.ERROR, errorMessage: data.errorMessage });
            }
        });
        this.setState({ password: '' });
    };

    render({ t, guide }, {
        status, password,
        errorCode, errorMessage, remainingAttempts, needsLongTouch
    }) {

        let submissionState = null;

        switch (status) {
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
            <div class="contentWithGuide">
                <div className={style.container}>
                    <BitBox />
                    <div className={style.content}>
                        {submissionState}
                        {status !== stateEnum.WAITING && (
                            <form onSubmit={this.handleSubmit}>
                                <div>
                                    <Input
                                        autoFocus
                                        getRef={ref => this.passwordInput = ref}
                                        id="password"
                                        type="password"
                                        label={t('unlock.input.label')}
                                        disabled={status === stateEnum.WAITING}
                                        placeholder={t('unlock.input.placeholder')}
                                        onInput={this.handleFormChange}
                                        value={password} />
                                </div>
                                <div>
                                    <Button
                                        primary
                                        type="submit"
                                        disabled={!this.validate() || status === stateEnum.WAITING}>
                                        {t('Login')}
                                    </Button>
                                </div>
                                <hr />
                                <Footer>
                                    <Shift style="max-width: 100px; margin: auto auto auto 0;" />
                                </Footer>
                            </form>
                        )}
                    </div>
                </div>
                <Guide guide={guide}>
                    <Entry title="What do I do if I forgot the PIN?">
                        <p>Reset device and restore from backup.</p>
                        <Entry title="How do I reset the device?">
                            <p>Enter a wrong PIN 15 times. The last few attempts require a long touch on the device.</p>
                        </Entry>
                    </Entry>
                </Guide>
            </div>
        );
    }
}
