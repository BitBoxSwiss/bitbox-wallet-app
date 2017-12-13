import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import { appTranslations as appTranslationsDE } from './locale/de';
import { appTranslations as appTranslationsEN } from './locale/en';
import { userLanguage } from './util';

i18n
    .init({
        lng: userLanguage,
        fallbackLng: 'en',

        // have a common namespace used around the full app
        ns: ['app', 'wallet'],
        defaultNS: 'app',

        debug: true,

        interpolation: {
            escapeValue: false // not needed for react
        },

        react: {
            wait: true
        }
    });

i18n.addResourceBundle('en', 'app', appTranslationsEN);
i18n.addResourceBundle('de', 'app', appTranslationsDE);

export default i18n;
