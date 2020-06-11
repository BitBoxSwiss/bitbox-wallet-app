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
import appTranslationsDE from '../locales/de/app.json';
import appTranslationsEN from '../locales/en/app.json';
import appTranslationsFR from '../locales/fr/app.json';
import appTranslationsJA from '../locales/ja/app.json';
import appTranslationsRU from '../locales/ru/app.json';
import appTranslationsMS from '../locales/ms/app.json';
import appTranslationsPT from '../locales/pt/app.json';
import appTranslationsHI from '../locales/hi/app.json';
import appTranslationsBG from '../locales/bg/app.json';
import appTranslationsTR from '../locales/tr/app.json';
import appTranslationsZH from '../locales/zh/app.json';
import appTranslationsFA from '../locales/fa/app.json';
import appTranslationsES from '../locales/es/app.json';
import appTranslationsSL from '../locales/sl/app.json';
import { apiGet, apiPost } from '../utils/request';
import languageFromConfig from './config';
import Backend from 'i18next-locize-backend';
import locizeEditor from 'locize-editor';

// if a language is not officially added yet, add it through this env var to make it available
// (e.g. "es,fr,sl").
export const extraLanguages = process.env.PREACT_APP_I18N_ADDLANGUAGES;
export const i18nEditorActive = process.env.PREACT_APP_I18NEDITOR === '1';

const locizeProjectID = 'fe4e5a24-e4a2-4903-96fc-3d62c11fc502';

let i18Init = i18n
    .use(languageFromConfig);
if (i18nEditorActive) {
    i18Init = i18Init
        .use(Backend)
        .use(locizeEditor);
}
i18Init.init({
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
    },

    backend: {
        projectId: locizeProjectID,
        referenceLng: 'en'
    },
    editor: {
        enabled: i18nEditorActive,
        autoOpen: true,
        mode: 'iframe', // 'window',
        projectId: locizeProjectID,

        /* iframeContainerStyle: 'z-index: 2000; position: fixed; bottom: 0; right: 0; left: 0; height: 300px; box-shadow: -3px 0 5px 0 rgba(0,0,0,0.5);',
         * iframeStyle: 'width: 100%; height: 300px; border: none;',
         * bodyStyle: 'margin-bottom: 205px;', */
        onEditorSaved: (lng, ns) => {
            i18n.reloadResources(lng, ns);
        }
    },
});

if (!i18nEditorActive) {
    i18n.addResourceBundle('de', 'app', appTranslationsDE);
    i18n.addResourceBundle('en', 'app', appTranslationsEN);
    i18n.addResourceBundle('fr', 'app', appTranslationsFR);
    i18n.addResourceBundle('ja', 'app', appTranslationsJA);
    i18n.addResourceBundle('ms', 'app', appTranslationsMS);
    i18n.addResourceBundle('ru', 'app', appTranslationsRU);
    i18n.addResourceBundle('pt', 'app', appTranslationsPT);
    i18n.addResourceBundle('hi', 'app', appTranslationsHI);
    i18n.addResourceBundle('bg', 'app', appTranslationsBG);
    i18n.addResourceBundle('tr', 'app', appTranslationsTR);
    i18n.addResourceBundle('zh', 'app', appTranslationsZH);
    i18n.addResourceBundle('fa', 'app', appTranslationsFA);
    i18n.addResourceBundle('es', 'app', appTranslationsES);
    i18n.addResourceBundle('sl', 'app', appTranslationsSL);
}

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
