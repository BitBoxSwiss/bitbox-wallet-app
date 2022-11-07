/**
 * Copyright 2020 Shift Crypto AG
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

// i18next configuration for tests.
// Some more examples: https://react.i18next.com/misc/testing.
//
// It is in a special directory __mocks__ so that when a component imports i18n
// module, jest replaces it with this version.
// In order for i18n to be replaced in tests, add the following after importing
// jest: jest.mock('../../../src/i18n/i18n').
//
// See docs for more details:
// https://jestjs.io/docs/en/manual-mocks

import i18n from 'i18next';

i18n.init({
  lng: 'en',
  fallbackLng: 'en',

  ns: ['app', 'wallet'],
  defaultNS: 'app',

  debug: false,
  returnObjects: true,
  interpolation: { escapeValue: false }, // react already escapes
  react: {
    wait: false, // no backend to wait in tests
    defaultTransParent: 'div', // required for preact
  },

  resources: { en: {} },
});

export default i18n;
