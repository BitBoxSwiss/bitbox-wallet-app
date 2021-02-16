/**
 * Copyright 2021 Shift Crypto AG
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

import { h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import LanguageSwitch from '../../../components/language/language';
import { Header } from '../../../components/layout/header';
import { Button  } from '../../../components/forms';
import * as style from '../../../components/steps/steps.css';
import { translate, TranslateProps } from '../../../decorators/translate';
import { SwissMadeOpenSource } from '../../../components/icon/logo';

interface SuccessProps {
    task: 'create' | 'restore' | null
}

type Props = SuccessProps & TranslateProps;

function Success({ t, task }: RenderableProps<Props>) {
    const content = (task === 'restore') ? (
        <div className={style.stepContext} style="max-width: 720px;">
            <h3>{t('bitbox02Wizard.stepBackupSuccess.title')}</h3>
            <p className="m-bottom-default">{t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}</p>
            <ul>
                <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
            </ul>
            <div className="buttons text-center">
                <Button primary onClick={() => route('/account-summary', true)}>
                    {t('success.getstarted')}
                </Button>
            </div>
        </div>
    ) : (
        <div className={style.stepContext} style="max-width: 720px;">
            <h3>{t('bitbox02Wizard.success.title')}</h3>
            <p>{t('bitbox02Wizard.stepCreateSuccess.success')}</p>
            <p>{t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}</p>
            <div className="buttons text-center">
                <Button primary onClick={() => route('/account-summary', true)}>
                    {t('success.getstarted')}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="contentWithGuide">
            <div className="container">
                <Header title={<h2>{t('welcome.title')}</h2>}>
                    <LanguageSwitch />
                </Header>
                <div className="flex flex-1 flex-column flex-items-center scrollableContainer">
                    {content}
                    <div className="text-center m-top-large">
                        <SwissMadeOpenSource large />
                    </div>
                </div>
            </div>
        </div>
    );
}

const HOC = translate<SuccessProps>()(Success);
export { HOC as Success };