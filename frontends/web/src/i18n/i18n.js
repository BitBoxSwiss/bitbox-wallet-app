import i18n from 'i18next';
import appTranslationsDE from './de';
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
    apiGet('config').then((config) => {
        const newConf = Object.assign(config, {
            frontend: Object.assign({}, config.frontend, {
                userLanguage: lng
            })
        });
        apiPost('config', newConf);
    });
});

export default i18n;
