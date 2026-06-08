// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { HashRouter } from 'react-router-dom';
import { App } from './app';
import { i18n } from './i18n/i18n';
import './style/index.css';

const rootEl = document.getElementById('root') as HTMLDivElement;
const root = createRoot(rootEl);

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <React.Suspense fallback={null}>
        <HashRouter>
          <App />
        </HashRouter>
      </React.Suspense>
    </I18nextProvider>
  </React.StrictMode>
);
