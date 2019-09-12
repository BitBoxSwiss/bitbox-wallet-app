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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { route } from 'preact-router';
import { apiGet, apiPost } from '../../utils/request';
import { Button } from '../../components/forms';
import { PasswordSingleInput } from '../../components/password';
import { Message } from '../../components/message/message';
import { Shift } from '../../components/icon/logo';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { Header, Footer } from '../../components/layout';
import Spinner from '../../components/spinner/Spinner';
import { AppLogo } from '../../components/icon/logo';

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
        password: '',
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

    handleFormChange = password => {
        this.setState({ password });
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
            if (data.success) {
                apiGet('devices/' + this.props.deviceID + '/status').then(status => {
                    if (status === 'seeded') {
                        console.log('unlock.jsx route to /account'); // eslint-disable-line no-console
                        route('/account', true);
                    }
                });
            }
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

    render({
        t,
    }, {
        status,
        password,
        errorCode,
        errorMessage,
        remainingAttempts,
        needsLongTouch,
    }) {
        let submissionState = null;
        switch (status) {
        case stateEnum.DEFAULT:
            submissionState = <p>{t('unlock.description')}</p>;
            break;
        case stateEnum.WAITING:
            submissionState = <Spinner text={t('unlock.unlocking')} showLogo />;
            break;
        case stateEnum.ERROR:
            submissionState = (
                <Message type="error">
                    {t(`unlock.error.e${errorCode}`, {
                        defaultValue: errorMessage,
                        remainingAttempts,
                        context: needsLongTouch ? 'touch' : 'normal'
                    })}
                </Message>
            );
        }

        return (
            <div class="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('welcome.title')}</h2>} />
                    <div className="innerContainer">
                        <div className="content narrow padded isVerticallyCentered">
                            <AppLogo />
                            <div class="box large">
                                {submissionState}
                                {
                                    status !== stateEnum.WAITING && (
                                        <form onSubmit={this.handleSubmit}>
                                            <div className="m-top-default">
                                                <PasswordSingleInput
                                                    autoFocus
                                                    getRef={ref => this.passwordInput = ref}
                                                    id="password"
                                                    type="password"
                                                    label={t('unlock.input.label')}
                                                    disabled={status === stateEnum.WAITING}
                                                    placeholder={t('unlock.input.placeholder')}
                                                    onValidPassword={this.handleFormChange}
                                                    value={password} />
                                            </div>
                                            <div className="buttons">
                                                <Button
                                                    primary
                                                    type="submit"
                                                    disabled={!this.validate() || status === stateEnum.WAITING}>
                                                    {t('button.unlock')}
                                                </Button>
                                            </div>
                                        </form>
                                    )
                                }
                            </div>
                        </div>
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.unlock.forgotDevicePassword" entry={t('guide.unlock.forgotDevicePassword')} />
                    <Entry key="guide.unlock.reset" entry={t('guide.unlock.reset')} />
                </Guide>
            </div>
        );
    }
}
