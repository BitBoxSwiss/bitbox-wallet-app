import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiPost } from '../../../utils/request';
import { PasswordRepeatInput } from '../../../components/password';
import { Button } from '../../../components/forms';
import Message from '../../../components/message/message';
import { Shift } from '../../../components/icon/logo';
import Footer from '../../../components/footer/footer';
import Spinner from '../../../components/spinner/Spinner';
import { Steps, Step } from './components/steps';
import InnerHTMLHelper from '../../../utils/innerHTML';
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
        errorMessage: '',
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
            <div className={style.block}>
                <h2>{t('initialize.info.subtitle')}</h2>
                <ul>
                    <InnerHTMLHelper tagName="li" html={t('initialize.info.description_1')} />
                    <InnerHTMLHelper tagName="li" html={t('initialize.info.description_2')} />
                </ul>
                <InnerHTMLHelper tagName="p" html={t('initialize.info.description_3')} />
                <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.back')}
                    </Button>
                    <Button primary onClick={this.handleStart}>
                        {t('initialize.info.button')}
                    </Button>
                </div>
            </div>
        ) : (
            <form onSubmit={this.handleSubmit} class="flex-1">
                <PasswordRepeatInput
                    pattern="^.{4,}$"
                    title={t('initialize.input.invalid')}
                    label={t('initialize.input.label')}
                    repeatLabel={t('initialize.input.labelRepeat')}
                    repeatPlaceholder={t('initialize.input.placeholderRepeat')}
                    ref={ref => this.passwordInput = ref}
                    disabled={status === stateEnum.WAITING}
                    onValidPassword={this.setValidPassword} />
                <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.back')}
                    </Button>
                    <Button
                        type="submit"
                        primary
                        disabled={!password || status === stateEnum.WAITING}>
                        {t('initialize.create')}
                    </Button>
                </div>
            </form>
        );

        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <div className={style.content}>
                        <Steps current={1}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3_${goal}.title`)} description={t(`goal.step.3_${goal}.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_${goal}.title`)} description={t(`goal.step.4_${goal}.description`)} />
                        </Steps>
                        <hr />
                        {formSubmissionState}
                        <h1 className={style.title}>{t(showInfo ? 'initialize.info.title' : 'setup')}</h1>
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
            </div>
        );
    }
}
