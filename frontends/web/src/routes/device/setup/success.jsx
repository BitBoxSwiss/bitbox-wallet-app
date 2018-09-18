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
import { Shift } from '../../../components/icon';
import Footer from '../../../components/footer/footer';
import { Steps, Step } from './components/steps';
import * as style from '../device.css';

@translate()
export default class Success extends Component {
    render({
        t,
        goal,
    }, {
    }) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <div className={style.content}>
                        <Steps current={3}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3_${goal}.title`)} description={t(`goal.step.3_${goal}.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_${goal}.title`)} description={t(`goal.step.4_${goal}.description`)} />
                        </Steps>
                        <hr />
                        <h1 class={style.title}>{t(`success.${goal}.title`)}</h1>
                        <div class={style.block}>
                            {t(`success.${goal}.info`)}
                        </div>
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
