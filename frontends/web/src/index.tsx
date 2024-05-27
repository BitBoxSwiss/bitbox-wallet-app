/**
 * Copyright 2018 Shift Devices AG
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

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app';
import { i18n } from './i18n/i18n';
import './style/index.css';

// // debug
// const originalPushState = window.history.pushState;

// // Create a new proxy object
// const pushStateProxy = new Proxy(originalPushState, {
//   apply(target, thisArg, argumentsList) {
//     // Log the arguments passed to history.pushState
//     alert(`history.pushState called with arguments: ${JSON.stringify(argumentsList)}`);
//     return window.Reflect.apply(target, thisArg, argumentsList);
//   }
// });

// // Override the original pushState with the proxy
// window.history.pushState = pushStateProxy;

const rootEl = document.getElementById('root') as HTMLDivElement;
const root = createRoot(rootEl);


root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <React.Suspense fallback={null}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.Suspense>
    </I18nextProvider>
  </React.StrictMode>
);
