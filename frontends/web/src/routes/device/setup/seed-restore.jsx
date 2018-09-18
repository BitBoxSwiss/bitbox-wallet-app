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
import { apiGet } from '../../../utils/request';
import { Button } from '../../../components/forms';
import Backups from '../../../components/backups/backups';
import Message from '../../../components/message/message';
import { Shift } from '../../../components/icon/logo';
import Footer from '../../../components/footer/footer';
import Spinner from '../../../components/spinner/Spinner';
import { Steps, Step } from './components/steps';
import * as style from '../device.css';

const STATUS = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error',
});

@translate()
export default class SeedRestore extends Component {
    state = {
        showInfo: true,
        status: STATUS.DEFAULT,
        error: '',
    }

    componentDidMount () {
        this.checkSDcard();
    }

    displayError = error => {
        this.setState({
            status: STATUS.ERROR,
            error,
        });
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
        onSuccess,
    }, {
        showInfo,
        status,
        error,
    }) {
        return (
            <div class="contentWithGuide">
                <div className={[style.container, style.scrollable].join(' ')}>
                    <div className={style.content}>
                        <Steps current={2}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3_restore.title`)} description={t(`goal.step.3_restore.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_restore.title`)} description={t(`goal.step.4_restore.description`)} />
                        </Steps>
                        <hr />
                        {
                            error && (
                                <Message type={status === STATUS.ERROR && 'error'}>
                                    { error }
                                </Message>
                            )
                        }
                        <h1 className={style.title}>{t('seedRestore.title')}</h1>
                        {
                            showInfo ? (
                                <div class={style.block}>
                                    <h2>{t('seedRestore.info.title')}</h2>
                                    <p>{t('seedRestore.info.description')}</p>
                                    <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                                        <Button
                                            secondary
                                            onClick={goBack}>
                                            {t('button.back')}
                                        </Button>
                                        <Button primary onClick={this.handleStart}>
                                            {t('seedRestore.info.button')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Backups
                                    showCreate={false}
                                    displayError={this.displayError}
                                    deviceID={deviceID}
                                    requireConfirmation={false}
                                    onRestore={onSuccess}
                                    fillSpace>
                                    <Button
                                        secondary
                                        onClick={goBack}>
                                        {t('button.back')}
                                    </Button>
                                </Backups>
                            )
                        }
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
