/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022-2024 Shift Crypto AG
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

import { call } from './transport-qt';
import { mobileCall } from './transport-mobile';
import { runningInQtWebEngine, runningOnMobile } from './env';

// extConfig is a way to set config values which are inserted
// externally by templating engines (code generation). A default value
// is provided in case the file wasn't generated but used directly,
// for convenience when developing. Both key and defaultValue must be
// strings and converted into the desired type.
const extConfig = (key: string, defaultValue: string): string => {
  if (key.startsWith('{{ ') && key.endsWith(' }}')) {
    return defaultValue;
  }
  return key;
};

export const apiPort = extConfig('{{ API_PORT }}', '8082');
export const apiToken = extConfig('{{ API_TOKEN }}', '');

export const isTLS = (): boolean => {
  return document.URL.startsWith('https://');
};

export const apiURL = (endpoint: string): string => {
  return (isTLS() ? 'https://' : 'http://') + 'localhost:' + apiPort + '/api/' + endpoint;
};

export const apiGet = (endpoint: string): Promise<any> => {
  // if apiGet() is invoked immediately this can error with:
  // request.js:64 Uncaught TypeError: Cannot read properties of undefined
  // (reading 'runningInQtWebEngine')
  // TODO: maybe use extConfig('{{ ENGINE_QTWEB }}', 'no') === 'yes' instead of runningInQtWebEngine()?
  // drawback: not treeshakeable
  if (runningInQtWebEngine()) {
    return call(JSON.stringify({
      method: 'GET',
      endpoint,
    }));
  }
  if (runningOnMobile()) {
    return mobileCall(JSON.stringify({
      method: 'GET',
      endpoint,
    }));
  }
  return fetch(apiURL(endpoint), {
    method: 'GET'
  }).then(response => response.json());
};

export const apiPost = (
  endpoint: string,
  body?: object | number | string | boolean, // any is not safe to use, for example Set and Map are stringified to empty "{}"
): Promise<any> => {
  if (runningInQtWebEngine()) {
    return call(JSON.stringify({
      method: 'POST',
      endpoint,
      body: JSON.stringify(body)
    }));
  }
  if (runningOnMobile()) {
    return mobileCall(JSON.stringify({
      method: 'POST',
      endpoint,
      body: JSON.stringify(body)
    }));
  }
  return fetch(apiURL(endpoint), {
    method: 'POST',
    body: JSON.stringify(body)
  }).then(response => response.json());
};
