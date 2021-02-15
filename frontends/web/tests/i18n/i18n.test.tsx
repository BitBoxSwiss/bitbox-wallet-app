/**
 * Copyright 2020 Shift Crypto AG
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

jest.mock('../../src/utils/request');

jest.mock('i18next', () => {
    // See i18next API docs this mock models after:
    // https://www.i18next.com/overview/api
    const i18nextMock:any = {listeners: {}};
    i18nextMock.use = () => i18nextMock;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    i18nextMock.addResourceBundle = () => {};
    i18nextMock.init = (_opts, cb) => {
        if (cb) {
            cb(null, (k) => k);
        }
        return Promise.resolve((k) => k);
    };
    i18nextMock.on = (eventName, fn) => {
        i18nextMock.listeners[eventName] = fn;
    };

    return {
        __esModule: true,
        default: i18nextMock,
    };
});

import i18n from '../../src/i18n/i18n';
import { apiGet, apiPost } from '../../src/utils/request';

describe('i18n', () => {
    describe('languageChanged', () => {
        beforeEach(() => {
            (apiPost as jest.Mock).mockImplementation(() => {
                return Promise.resolve();
            });
        });

        const table = [
            {nativeLocale: 'de', newLang: 'de', userLang: null},
            {nativeLocale: 'de-DE', newLang: 'de', userLang: null},
            {nativeLocale: 'pt_BR', newLang: 'pt', userLang: null},
            {nativeLocale: 'fr', newLang: 'en', userLang: 'en'},
        ];
        table.forEach((test) => {
            it(`sets userLanguage to ${test.userLang} if native-locale is ${test.nativeLocale}`, (done) => {
                (apiGet as jest.Mock).mockImplementation(endpoint => {
                    switch (endpoint) {
                        case 'config': { return Promise.resolve({}); }
                        case 'native-locale': { return Promise.resolve(test.nativeLocale); }
                        default: { return Promise.resolve(); }
                    }
                });
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                i18n.listeners.languageChanged(test.newLang).then(() => {
                    expect(apiPost).toBeCalledWith('config', {
                        frontend: {},
                        backend: {userLanguage: test.userLang},
                    });
                    done();
                });
            });
        });
    });
});
