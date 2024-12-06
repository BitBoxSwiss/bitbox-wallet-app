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

import { describe, expect, it, Mock, vi } from 'vitest';
vi.mock('./i18n');

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(null),
}));


import { apiGet } from '@/utils/request';
import { languageFromConfig } from './config';


describe('language detector', () => {
  it('defaults to english', () => new Promise<void>(done => {
    (apiGet as Mock).mockResolvedValue({});
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('en');
      done();
    });
  }));

  it('prefers userLanguage if available', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({ backend: { userLanguage: 'it' } }); }
      case 'native-locale': { return Promise.resolve('de'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('it');
      done();
    });
  }));

  it('uses native-locale if no config', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({}); }
      case 'native-locale': { return Promise.resolve('de'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('de');
      done();
    });
  }));

  it('uses defaultUserLanguage fallback if native-locale is C.UTF-8', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({}); }
      case 'native-locale': { return Promise.resolve('C.UTF-8'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('en');
      done();
    });
  }));

  it('uses native-locale if userLanguage is empty', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({ backend: { userLanguage: '' } }); }
      case 'native-locale': { return Promise.resolve('de'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('de');
      done();
    });
  }));

  it('returns native-locale value acceptable by i18next', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({}); }
      case 'native-locale': { return Promise.resolve('pt_BR'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang) => {
      expect(lang).toEqual('pt-BR');
      done();
    });
  }));

});
