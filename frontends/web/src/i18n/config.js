import { apiGet } from '../utils/request';

export default {
    type: 'languageDetector',
    async: true,
    detect: (cb) => {
        apiGet('config').then(({ frontend }) => {
            if (!frontend || !frontend.userLanguage) {
                return cb(null);
            }
            cb(frontend.userLanguage);
        });
    },
    init: (a) => {
        // console.log('languageDetector init', a)
    },
    cacheUserLanguage: (a) => {
        // console.log('cacheUserLanguage', a);
    }
};
