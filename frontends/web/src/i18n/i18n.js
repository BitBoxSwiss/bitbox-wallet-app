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

import i18n from 'i18next';
// import appTranslationsDE from './de';
import appTranslationsEN from './en';
import { apiGet, apiPost } from '../utils/request';
import languageFromConfig from './config';

i18n
    .use(languageFromConfig)
    .init({
        // lng: userLanguage,
        fallbackLng: 'en',

        // have a common namespace used around the full app
        ns: ['app', 'wallet'],
        defaultNS: 'app',

        debug: false,
        returnObjects: true,

        interpolation: {
            escapeValue: false // not needed for react
        },

        react: {
            wait: true
        }
    });


i18n.addResourceBundle('en', 'app', appTranslationsEN);
//i18n.addResourceBundle('de', 'app', appTranslationsDE);

i18n.on('languageChanged', (lng) => {
    apiGet('config').then((config = {}) => {
        if (config.frontend && config.frontend.userLanguage === lng) {
            return;
        }
        const newConf = Object.assign(config, {
            frontend: Object.assign({}, config.frontend, {
                userLanguage: lng
            })
        });
        apiPost('config', newConf);
    });
});

export default i18n;
