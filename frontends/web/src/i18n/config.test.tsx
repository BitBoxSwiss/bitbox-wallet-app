// SPDX-License-Identifier: Apache-2.0

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
    languageFromConfig.detect((lang: any) => {
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
    languageFromConfig.detect((lang: any) => {
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
    languageFromConfig.detect((lang: any) => {
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
    languageFromConfig.detect((lang: any) => {
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
    languageFromConfig.detect((lang: any) => {
      expect(lang).toEqual('de');
      done();
    });
  }));

  it('uses weird Android native-locale if userLanguage is empty', () => new Promise<void>(done => {
    (apiGet as Mock).mockImplementation(endpoint => {
      switch (endpoint) {
      case 'config': { return Promise.resolve({ backend: { userLanguage: '' } }); }
      case 'native-locale': { return Promise.resolve('de-DE_#u-fw-mon-mu-celsius'); }
      default: { return Promise.resolve(); }
      }
    });
    languageFromConfig.detect((lang: any) => {
      expect(lang).toEqual('de-DE');
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
    languageFromConfig.detect((lang: any) => {
      expect(lang).toEqual('pt-BR');
      done();
    });
  }));

});
