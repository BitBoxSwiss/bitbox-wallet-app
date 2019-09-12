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
import { apiGet, apiPost } from '../../../utils/request';
import { PasswordRepeatInput } from '../../../components/password';
import { Button, Input, Checkbox } from '../../../components/forms';
import { Message } from '../../../components/message/message';
import { Shift, Alert } from '../../../components/icon';
import { Header, Footer } from '../../../components/layout';
import Spinner from '../../../components/spinner/Spinner';
import warning from '../../../assets/icons/warning.png';
import * as style from '../device.css';

const STATUS = Object.freeze({
    DEFAULT: 'default',
    CREATING: 'creating',
    CHECKING: 'checking',
    ERROR: 'error',
});

@translate()
export default class SeedCreateNew extends Component {
    state = {
        showInfo: true,
        status: STATUS.CHECKING,
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
        // @ts-ignore
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
        this.setState({ status: STATUS.CREATING, error: '' });
        apiPost('devices/' + this.props.deviceID + '/create-wallet', {
            walletName: this.state.walletName,
            backupPassword: this.state.backupPassword
        }).then(data => {
            if (!data.success) {
                this.setState({
                    status: STATUS.ERROR,
                    error: this.props.t(`seed.error.e${data.code}`, {
                        defaultValue: data.errorMessage
                    }),
                });
            } else {
                this.props.onSuccess();
            }
            if (this.backupPasswordInput) {
                this.backupPasswordInput.getWrappedInstance().clear();
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
                error: this.props.t('seed.error.e200'),
            });
            setTimeout(this.checkSDcard, 2500);
        });
    }

    handleStart = () => {
        this.setState({ showInfo: false });
        this.checkSDcard();
    }

    renderSpinner() {
        switch (this.state.status) {
        case STATUS.CHECKING:
            return (<Spinner text={this.props.t('checkSDcard')} showLogo />);
        case STATUS.CREATING:
            return (<Spinner text={this.props.t('seed.creating')} showLogo />);
        default:
            return null;
        }
    }

    render({
        t,
        goBack,
    }, {
        showInfo,
        status,
        walletName,
        error,
        agreements,
    }) {
        const content = showInfo ? (
            <div class="box large">
                <ol class="first">
                    <li>{t('seed.info.description1')}</li>
                    <li>{t('seed.info.description2')}</li>
                </ol>
                <p>{t('seed.info.description3')}</p>
                <p>{t('seed.info.description4')}</p>
                <div className="buttons">
                    <Button
                        primary
                        onClick={this.handleStart}
                        disabled={status !== STATUS.DEFAULT}>
                        {t('seed.info.button')}
                    </Button>
                    <Button
                        transparent
                        onClick={goBack}>
                        {t('button.abort')}
                    </Button>
                </div>
            </div>
        ) : (
            <form onSubmit={this.handleSubmit} className="box large">
                <div>
                    <Input
                        pattern="^[0-9a-zA-Z-_]{1,31}$"
                        autoFocus
                        id="walletName"
                        label={t('seed.walletName.label')}
                        disabled={status === STATUS.CREATING}
                        onInput={this.handleFormChange}
                        getRef={ref => this.walletNameInput = ref}
                        value={walletName} />
                    <PasswordRepeatInput
                        label={t('seed.password.label')}
                        repeatPlaceholder={t('seed.password.repeatPlaceholder')}
                        ref={ref => this.backupPasswordInput = ref}
                        disabled={status === STATUS.CREATING}
                        onValidPassword={this.setValidBackupPassword} />
                </div>
                <div class={style.agreements}>
                    <div class="flex flex-row flex-start flex-items-center">
                        <img src={warning} style="width: 18px; margin-right: 10px; position: relative; bottom: 1px;" />
                        <p class={style.agreementsLabel}>{t('seed.description')}</p>
                    </div>
                    <Checkbox
                        id="password_change"
                        label={t('seed.agreements.password-change')}
                        checked={agreements.password_change}
                        onChange={this.handleAgreementChange} />
                    <Checkbox
                        id="password_required"
                        label={t('seed.agreements.password-required')}
                        checked={agreements.password_required}
                        onChange={this.handleAgreementChange} />
                    <Checkbox
                        id="funds_access"
                        label={t('seed.agreements.funds-access')}
                        checked={agreements.funds_access}
                        onChange={this.handleAgreementChange} />
                </div>
                <div className="buttons">
                    <Button
                        type="submit"
                        primary
                        disabled={!this.validate() || status === STATUS.CREATING}>
                        {t('seed.create')}
                    </Button>
                    <Button
                        transparent
                        onClick={goBack}>
                        {t('button.abort')}
                    </Button>
                </div>
            </form>
        );

        return (
            <div class="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('setup')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded narrow isVerticallyCentered">
                            <h1 className={[style.title, 'text-center'].join(' ')}>{t('seed.info.title')}</h1>
                            {
                                error && (
                                    <Message type={status === STATUS.ERROR ? 'error' : undefined}>
                                        <Alert />
                                        { error }
                                    </Message>
                                )
                            }
                            {content}
                        </div>
                        { this.renderSpinner() }
                    </div>
                    <Footer>
                        <Shift />
                    </Footer>
                </div>
            </div>
        );
    }
}
