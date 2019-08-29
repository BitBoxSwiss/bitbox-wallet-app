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
import { Button } from '../../../../components/forms';
import { apiPost } from '../../../../utils/request';
import { Dialog } from '../../../../components/dialog/dialog';
import { CopyableInput } from '../../../../components/copy/Copy';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';

@translate()
export default class RandomNumber extends Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            number: undefined,
        };
    }

    getRandomNumber = () => {
        apiPost(this.props.apiPrefix + '/random-number').then(number => {
            this.setState({
                active: true,
                number,
            });
        });
    }

    abort = () => {
        this.setState({
            active: false,
            number: undefined,
        });
    }

    render({ t }, { number, active }) {
        return (
            <div>
                <SettingsButton onClick={this.getRandomNumber}>
                    {t('random.button')}
                </SettingsButton>
                {
                    active && number ? (
                        <Dialog onClose={this.abort}>
                            <p>{t('random.description', { bits: number.length * 4 })}</p>
                            <CopyableInput value={number} />
                            <div class="flex flex-row flex-end flex-items-center">
                                <Button primary onClick={this.abort}>{t('button.ok')}</Button>
                            </div>
                        </Dialog>
                    ) : null
                }
            </div>
        );
    }
}
