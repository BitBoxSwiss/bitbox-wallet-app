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
import i18n from '../../i18n/i18n';
import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import { Shift, Alert } from '../../components/icon';
import { Guide } from '../../components/guide/guide';
import { Entry } from '../../components/guide/entry';
import Message from '../../components/message/message';
import Footer from '../../components/footer/footer';
import { debug } from '../../utils/env';
import InnerHTMLHelper from '../../utils/innerHTML';
import style from './device.css';

export default function Waiting({ testing }) {
    const title = i18n.t('welcome.title');
    return (
        <div class="contentWithGuide">
            <div className={style.container}>
                <div className={style.content}>
                    <div className="flex-1 flex flex-column flex-center">
                        {title && (<h1 style="text-align: center;">{title}</h1>)}
                        <h3 style="text-align: center;">{i18n.t('welcome.insertDevice')}</h3>
                        {i18n.t('welcome.paragraph')}
                        <Message type="warning" style="max-width: 400px; align-self: center;">
                            <Alert />
                            <InnerHTMLHelper tagName="p" html={i18n.t('deviceTampered')} style="margin-top: 0;" />
                        </Message>
                        <SkipForTestingButton show={debug && testing} />
                    </div>
                    <hr />
                    <Footer>
                        <Shift />
                    </Footer>
                </div>
            </div>
            <Guide screen="waiting">
                <Entry key="waitingWithoutDevice" title={i18n.t('guide.waitingWithoutDevice.title')}>
                    {!(debug && testing) && <p>{i18n.t('guide.waitingWithoutDevice.text.0')}</p>}
                    {debug && testing && <p>{i18n.t('guide.waitingWithoutDevice.text.1')}</p>}
                </Entry>
            </Guide>
        </div>
    );
}

class SkipForTestingButton extends Component {
    state = {
        testPIN: ''
    }

    registerTestingDevice = (e) => {
        apiPost('test/register', { pin: this.state.testPIN });
        e.preventDefault();
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    render({ show }, { testPIN }) {
        if (!show) {
            return null;
        }
        return (
            <form onSubmit={this.registerTestingDevice} style="flex-grow: 0; max-width: 400px; width: 100%; align-self: center;">
                <Input
                    type="password"
                    autoFocus
                    id="testPIN"
                    label="Test Password"
                    onInput={this.handleFormChange}
                    value={testPIN} />
                <Button type="submit" secondary>
                    Skip for Testing
                </Button>
            </form>
        );
    }
}
