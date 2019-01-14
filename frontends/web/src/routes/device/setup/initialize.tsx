/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, h, RenderableProps } from 'preact';
import { Button } from '../../../components/forms';
import { Header, Footer } from '../../../components/layout';
import { Shift } from '../../../components/icon/logo';
import { Message } from '../../../components/message/message';
import { PasswordRepeatInput } from '../../../components/password';
import Spinner from '../../../components/spinner/Spinner';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import * as style from '../device.css';
import { Step, Steps } from './components/steps';

const stateEnum = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error',
});

interface InitializeProps {
    goal: string;
    goBack: () => void;
    deviceID: string;
}

type Props = InitializeProps & TranslateProps;

interface State {
    showInfo: boolean;
    password: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string;
}

class Initialize extends Component<Props, State> {
    private passwordInput!: HTMLInputElement;

    constructor(props) {
        super(props);
        this.state = {
            showInfo: true,
            password: null,
            status: stateEnum.DEFAULT,
            errorCode: null,
            errorMessage: '',
        };
    }

    private handleSubmit = event => {
        event.preventDefault();
        if (!this.state.password) {
            return;
        }
        this.setState({
            status: stateEnum.WAITING,
            errorCode: null,
            errorMessage: '',
        });
        apiPost('devices/' + this.props.deviceID + '/set-password', {
            password: this.state.password,
        }).then(data => {
            if (!data.success) {
                if (data.code) {
                    this.setState({ errorCode: data.code });
                }
                this.setState({
                    status: stateEnum.ERROR,
                    errorMessage: data.errorMessage,
                });
            }
            if (this.passwordInput) {
                (this.passwordInput as any).getWrappedInstance().clear();
            }
        });
    }

    private setPasswordInputRef = (ref: HTMLInputElement) => {
        this.passwordInput = ref;
    }

    private setValidPassword = password => {
        this.setState({ password });
    }

    private handleStart = () => {
        this.setState({ showInfo: false });
    }

    public render(
        { t, goal, goBack }: RenderableProps<Props>,
        { showInfo, password, status, errorCode, errorMessage }: State,
    ) {
        let formSubmissionState;
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
                    {t(`initialize.error.e${errorCode}`, {
                        defaultValue: errorMessage,
                    })}
                </Message>
            );
        }

        const content = showInfo ? (
            <div className={style.block}>
                <div class="subHeaderContainer first">
                    <div class="subHeader">
                        <h3>{t('initialize.info.subtitle')}</h3>
                    </div>
                </div>
                <ul>
                    <li>{t('initialize.info.description1')}</li>
                    <li>{t('initialize.info.description2')}</li>
                </ul>
                <p>{t('initialize.info.description3')}</p>
                <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.abort')}
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
                    label={t('initialize.input.label')}
                    repeatLabel={t('initialize.input.labelRepeat')}
                    repeatPlaceholder={t('initialize.input.placeholderRepeat')}
                    ref={this.setPasswordInputRef}
                    disabled={status === stateEnum.WAITING}
                    onValidPassword={this.setValidPassword} />
                <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.abort')}
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
                    <Header title={
                        <Steps current={1}>
                            <Step title={t('goal.step.1.title')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3-${goal}.title`)} description={t(`goal.step.3-${goal}.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4-${goal}.title`)} />
                        </Steps>
                    } narrow={true} />
                    <div className={style.content}>
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

const TranslatedInitialize = translate<InitializeProps>()(Initialize);
export { TranslatedInitialize as Initialize };
