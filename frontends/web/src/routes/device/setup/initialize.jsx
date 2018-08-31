import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiPost } from '../../../utils/request';
import { PasswordRepeatInput } from '../../../components/password';
import { Button } from '../../../components/forms';
import Message from '../../../components/message/message';
import { BitBox, Shift } from '../../../components/icon/logo';
import { Guide } from '../../../components/guide/guide';
import Footer from '../../../components/footer/footer';
import Spinner from '../../../components/spinner/Spinner';
import { Steps, Step } from './components/steps';
import style from '../device.css';

const stateEnum = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error'
});

@translate()
export default class Initialize extends Component {
    state = {
        showInfo: true,
        password: null,
        status: stateEnum.DEFAULT,
        errorCode: null,
        errorMessage: ''
    }

    handleSubmit = event => {
        event.preventDefault();
        if (!this.state.password) {
            return;
        }
        this.setState({
            status: stateEnum.WAITING,
            errorCode: null,
            errorMessage: ''
        });
        apiPost('devices/' + this.props.deviceID + '/set-password', {
            password: this.state.password
        }).then(data => {
            if (!data.success) {
                if (data.code) {
                    this.setState({ errorCode: data.code });
                }
                this.setState({
                    status: stateEnum.ERROR,
                    errorMessage: data.errorMessage
                });
            }
            if (this.passwordInput) {
                this.passwordInput.clear();
            }
        });
    };

    setValidPassword = password => {
        this.setState({ password });
    }

    handleStart = () => {
        this.setState({ showInfo: false });
    }

    render({
        t,
        goal,
        goBack,
    }, {
        showInfo,
        password,
        status,
        errorCode,
        errorMessage,
    }) {

        let formSubmissionState = null;

        switch (status) {
        case stateEnum.DEFAULT:
            formSubmissionState = null;
            break;
        case stateEnum.WAITING:
            formSubmissionState = <Message type="info">{t('initialize.creating')}</Message>;
            break;
        case stateEnum.ERROR:
            formSubmissionState = (
                <Message type="error">
                    {t(`initialize.error.${errorCode}`, {
                        defaultValue: errorMessage
                    })}
                </Message>
            );
        }

        const content = showInfo ? (
            <div>
                <h2>{t('initialize.info.title')}</h2>
                <p>{t('initialize.info.description')}</p>
                <Button primary onClick={this.handleStart}>
                    {t('initialize.info.button')}
                </Button>
                <Button
                    transparent
                    onClick={goBack}>
                    {t('button.back')}
                </Button>
            </div>
        ) : (
            <form onSubmit={this.handleSubmit}>
                <PasswordRepeatInput
                    pattern="^.{4,}$"
                    title={t('initialize.input.invalid')}
                    label={t('initialize.input.label')}
                    repeatLabel={t('initialize.input.labelRepeat')}
                    repeatPlaceholder={t('initialize.input.placeholderRepeat')}
                    ref={ref => this.passwordInput = ref}
                    disabled={status === stateEnum.WAITING}
                    onValidPassword={this.setValidPassword} />
                <div>
                    <Button
                        type="submit"
                        primary
                        disabled={!password || status === stateEnum.WAITING}>
                        {t('initialize.create')}
                    </Button>
                    <Button
                        transparent
                        onClick={goBack}>
                        {t('button.back')}
                    </Button>
                </div>
            </form>
        );

        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <BitBox />
                    <div className={style.content}>
                        <h1 className={style.title}>{t('setup')}</h1>
                        <Steps current={0}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step title={t(`goal.step.2_${goal}.title`)} description={t(`goal.step.2_${goal}.description`)} />
                            <Step title={t(`goal.step.3_${goal}.title`)} description={t(`goal.step.3_${goal}.description`)}  />
                        </Steps>
                        {formSubmissionState}
                        {content}
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                    {
                        status === stateEnum.WAITING && (
                            <Spinner text={t('initialize.creating')} showLogo />
                        )
                    }
                </div>
                <Guide screen="initialize" />
            </div>
        );
    }
}
