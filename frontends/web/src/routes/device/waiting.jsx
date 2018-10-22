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
import { apiPost } from '../../utils/request';
import { Button } from '../../components/forms';
import { PasswordSingleInput } from '../../components/password';
import { Shift } from '../../components/icon';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import { Tampered } from './setup/components/tampered';
import Header from '../../components/header/Header';
import Footer from '../../components/footer/footer';
import { debug } from '../../utils/env';
import * as style from './device.css';

@translate()
export default class Waiting extends Component {
    render({
        t,
        testing,
    }) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <Header title={<h2>{t('welcome.title')}</h2>} {...this.props} />
                    <div className={style.content}>
                        <div className="flex-1 flex flex-column flex-center">
                            <h3 style="text-align: center;">{t('welcome.insertDevice')}</h3>
                            <Tampered style="max-width: 400px; align-self: center;" />
                            <SkipForTestingButton show={debug && testing} />
                        </div>
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
                <Guide>
                    <Entry entry={t('guide.waiting.welcome')} shown={true} />
                    <Entry entry={t('guide.waiting.getDevice')} />
                    <Entry entry={t('guide.waiting.lostDevice')} />
                    <Entry entry={t('guide.waiting.internet')} />
                    <Entry entry={t('guide.waiting.deviceNotRecognized')} />
                    <Entry entry={t('guide.waiting.useWithoutDevice')} />
                </Guide>
            </div>
        );
    }
}

class SkipForTestingButton extends Component {
    state = {
        testPIN: ''
    }

    registerTestingDevice = (e) => {
        apiPost('test/register', { pin: this.state.testPIN });
        e.preventDefault();
    }

    handleFormChange = value => {
        this.setState({ testPIN: value });
    };

    render({ show }, { testPIN }) {
        if (!show) {
            return null;
        }
        return (
            <form onSubmit={this.registerTestingDevice} style="flex-grow: 0; max-width: 400px; width: 100%; align-self: center;">
                <PasswordSingleInput
                    type="password"
                    autoFocus
                    label="Test Password"
                    onValidPassword={this.handleFormChange}
                    value={testPIN} />
                <Button type="submit" secondary>
                    Skip for Testing
                </Button>
            </form>
        );
    }
}
