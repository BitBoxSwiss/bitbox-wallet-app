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
import { BitBox, Shift } from '../../components/icon/logo';
import { Guide, Entry } from '../../components/guide/guide';
import Footer from '../../components/footer/footer';
import { debug } from '../../utils/env';
import style from './device.css';

export default function Waiting({ testing, guide }) {
    const title = i18n.t('welcome.title');
    return (
        <div class="contentWithGuide">
            <div className={style.container}>
                <div className={style.content} style="text-align: center;">
                    {title && (<h1>{title}</h1>)}
                    <h3>{i18n.t('welcome.insertDevice')}</h3>
                    {i18n.t('welcome.paragraph')}
                    {i18n.t('deviceTampered')}
                    <SkipForTestingButton show={debug && testing} />
                    <hr />
                    <Footer>
                        <Shift />
                    </Footer>
                </div>
            </div>
            <Guide guide={guide} screen="waiting">
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
            <form onSubmit={this.registerTestingDevice} style="flex-grow: 0;">
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
