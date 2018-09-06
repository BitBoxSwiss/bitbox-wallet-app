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

import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { PasswordRepeatInput } from '../../../components/password';
import { Button, Input, Checkbox } from '../../../components/forms';
import Message from '../../../components/message/message';
import { Shift } from '../../../components/icon/logo';
import Footer from '../../../components/footer/footer';
import Spinner from '../../../components/spinner/Spinner';
import { Steps, Step } from './components/steps';
import warning from '../../../assets/icons/warning.png';
import style from '../device.css';

const STATUS = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error',
});

@translate()
export default class SeedCreateNew extends Component {
    state = {
        showInfo: true,
        status: STATUS.DEFAULT,
        walletName: '',
        backupPassword: '',
        error: '',
        agreements: {
            password_change: false,
            password_required: false,
            funds_access: false,
        },
    }

    componentDidMount () {
        this.checkSDcard();
    }

    validate = () => {
        if (!this.walletNameInput || !this.walletNameInput.validity.valid || !this.validAgreements()) {
            return false;
        }
        return this.state.backupPassword && this.state.walletName !== '';
    }

    handleFormChange = ({ target }) => {
        this.setState({ [target.id]: target.value });
    }

    handleSubmit = event => {
        event.preventDefault();
        if (!this.validate()) {
            return;
        }
        this.setState({
            status: STATUS.WAITING,
            error: '',
        });
        apiPost('devices/' + this.props.deviceID + '/create-wallet', {
            walletName: this.state.walletName,
            backupPassword: this.state.backupPassword
        }).then(data => {
            if (!data.success) {
                this.setState({
                    status: STATUS.ERROR,
                    error: this.props.t(`seed.error.${data.code}`, {
                        defaultValue: data.errorMessage
                    }),
                });
            } else {
                this.props.onSuccess();
            }
            if (this.backupPasswordInput) {
                this.backupPasswordInput.clear();
            }
            this.setState({ backupPassword: '' });
        });
    }

    setValidBackupPassword = backupPassword => {
        this.setState({ backupPassword });
    }

    validAgreements = () => {
        const { agreements } = this.state;
        const invalid = Object.keys(agreements).map(agr => agreements[agr]).includes(false);
        return !invalid;
    }

    handleAgreementChange = ({ target }) => {
        this.setState(state => ({ agreements: {
            ...state.agreements,
            [target.id]: target.checked
        } }));
    }

    checkSDcard = () => {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ sdcard }) => {
            if (sdcard) {
                return this.setState({ status: STATUS.DEFAULT, error: '' });
            }
            this.setState({
                status: STATUS.ERROR,
                error: this.props.t('seed.error.200'),
            });
            setTimeout(this.checkSDcard, 2500);
        });
    }

    handleStart = () => {
        this.setState({ showInfo: false });
        this.checkSDcard();
    }

    render({
        t,
        deviceID,
        goBack,
    }, {
        showInfo,
        status,
        walletName,
        error,
        agreements,
    }) {
        const content = showInfo ? (
            <div class={style.block}>
                <ol class="first">
                    <li>{t('seed.info.description_1')}</li>
                    <li>{t('seed.info.description_2')}</li>
                </ol>
                <p>{t('seed.info.description_3')}</p>
                <p>{t('seed.info.description_4')}</p>
                <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.back')}
                    </Button>
                    <Button primary onClick={this.handleStart}>
                        {t('seed.info.button')}
                    </Button>
                </div>
            </div>
        ) : (
            <form onSubmit={this.handleSubmit}>
                <div>
                    <Input
                        pattern="^[0-9a-zA-Z-_.]{1,31}$"
                        autoFocus
                        id="walletName"
                        label={t('seed.walletName.label')}
                        placeholder={t('seed.walletName.placeholder')}
                        disabled={status === STATUS.WAITING}
                        onInput={this.handleFormChange}
                        getRef={ref => this.walletNameInput = ref}
                        value={walletName} />
                    <PasswordRepeatInput
                        label={t('seed.password.label')}
                        repeatPlaceholder={t('seed.password.repeatPlaceholder')}
                        showLabel="Password"
                        ref={ref => this.backupPasswordInput = ref}
                        disabled={status === STATUS.WAITING}
                        onValidPassword={this.setValidBackupPassword} />
                </div>
                <div class={style.agreements}>
                    <div class="flex flex-row flex-start flex-items-center">
                        <img src={warning} style="width: 18px; margin-right: 10px; position: relative; bottom: 1px;" />
                        <p class={style.agreementsLabel}>{t('seed.description')}</p>
                    </div>
                    <Checkbox
                        id="password_change"
                        label={t('seed.agreements.password_change')}
                        checked={agreements.password_change}
                        onChange={this.handleAgreementChange} />
                    <Checkbox
                        id="password_required"
                        label={t('seed.agreements.password_required')}
                        checked={agreements.password_required}
                        onChange={this.handleAgreementChange} />
                    <Checkbox
                        id="funds_access"
                        label={t('seed.agreements.funds_access')}
                        checked={agreements.funds_access}
                        onChange={this.handleAgreementChange} />
                </div>
                <div className="buttons flex flex-row flex-between">
                    <Button
                        secondary
                        onClick={goBack}>
                        {t('button.back')}
                    </Button>
                    <Button
                        type="submit"
                        primary
                        disabled={!this.validate() || status === STATUS.WAITING}>
                        {t('seed.create')}
                    </Button>
                </div>
            </form>
        );

        return (
            <div class="contentWithGuide">
                <div className={[style.container, style.scrollable].join(' ')}>
                    <div className={style.content}>
                        <Steps current={2}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.2.title`)} description={t(`goal.step.2.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.3_create.title`)} description={t(`goal.step.3_create.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_create.title`)} description={t(`goal.step.4_create.description`)} />
                        </Steps>
                        <hr />
                        {
                            error && (
                                <Message type={status === STATUS.ERROR && 'error'}>
                                    { error }
                                </Message>
                            )
                        }
                        <h1 className={style.title}>{t('seed.info.title')}</h1>
                        {content}
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                    {
                        status === STATUS.WAITING && (
                            <Spinner text={t('seed.creating')} showLogo />
                        )
                    }
                </div>
            </div>
        );
    }
}
