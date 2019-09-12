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
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Shift } from '../../../components/icon';
import { Footer ,Header } from '../../../components/layout';
import { Button } from '../../../components/forms';
import * as style from '../device.css';

@translate()
export default class Success extends Component {

    handleGetStarted = () => {
        route('/account', true);
    }

    render({
        t,
        handleHideSuccess,
        goal,
    }, {
    }) {
        return (
            <div class="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('setup')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded narrow isVerticallyCentered">
                            <h1 className={[style.title, 'text-center'].join(' ')}>{t(`success.${goal}.title`)}</h1>
                            <div className="box large">
                                <p style="text-align: center;">
                                    {t(`success.${goal}.summary`)}
                                </p>
                                { goal === 'create' ? (
                                    <ul class={style.summary}>
                                        <li>{t('success.create.info1')}</li>
                                        <li>{t('success.create.info2')}</li>
                                        <li>{t('success.create.info3')}</li>
                                    </ul>
                                ) : null}
                                <div class="buttons">
                                    <Button primary onClick={this.handleGetStarted}>
                                        {t('success.getstarted')}
                                    </Button>
                                    <Button secondary onClick={handleHideSuccess}>
                                        {t('sidebar.device')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
