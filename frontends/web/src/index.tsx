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

// This file is the entry point used by 'preact-cli' to start the application.
// It is recommended to leave this file as 'index.js' and not rename it to 'index.jsx', 'index.ts'
// or 'index.tsx' (see https://github.com/wub/preact-cli-plugin-typescript#changing-the-entrypoint).

import { h } from 'preact';
import { I18nextProvider } from 'react-i18next';
import { App } from './app';
import i18n from './i18n/i18n';
import './style';

export default function Index() {
    return (
        <I18nextProvider i18n={i18n}><App /></I18nextProvider>
    );
}
