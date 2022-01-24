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

import { FunctionComponent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Entry } from '../../components/guide/entry';
import { Guide, store as panelStore } from '../../components/guide/guide';
import { AppLogo, SwissMadeOpenSource } from '../../components/icon/logo';
import { Footer, Header } from '../../components/layout';
import { setSidebarStatus } from '../../components/sidebar/sidebar';
import { debug } from '../../utils/env';
import { SkipForTesting } from './components/skipfortesting';
import style from './bitbox01/bitbox01.module.css';

export const Waiting: FunctionComponent = () => {
    const { t } = useTranslation();
    useEffect(() => {
        const { sidebarStatus } = panelStore.state;
        if (['forceCollapsed', 'forceHidden'].includes(sidebarStatus)) {
            setSidebarStatus('');
        }
    }, []);

    return (
        <div className="contentWithGuide">
            <div className="container">
                <Header title={<h2>{t('welcome.title')}</h2>} />
                <div className="content padded narrow isVerticallyCentered">
                    <div>
                        <AppLogo />
                        <div className="box large">
                            <h3 className={style.waitingText}>{t('welcome.insertDevice')}</h3>
                            <p className={style.waitingDescription}>{t('welcome.insertBitBox02')}</p>
                        </div>
                        {
                            debug && (
                                <div className={style.testingContainer}>
                                    <SkipForTesting show />
                                </div>
                            )
                        }
                    </div>
                </div>
                <Footer>
                    <SwissMadeOpenSource />
                </Footer>
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
    )
}
