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
import { Button } from '../../../components/forms';
import { Shift } from '../../../components/icon/logo';
import { Header, Footer } from '../../../components/layout';

@translate()
export default class Goal extends Component {
    render({
        t,
        onCreate,
        onRestore,
    }) {
        return (
            <div class="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('setup')}</h2>} />
                    <div className="innerContainer">
                        <div className="content padded narrow isVerticallyCentered">
                            <div className="box large">
                                <p class="first">{t('goal.paragraph')}</p>
                                <div class="buttons">
                                    <Button primary onClick={onCreate}>
                                        {t('goal.buttons.create')}
                                    </Button>
                                    <Button secondary onClick={onRestore}>
                                        {t('goal.buttons.restore')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Footer>
                        <Shift />
                    </Footer>
                </div>
            </div>
        );
    }
}
