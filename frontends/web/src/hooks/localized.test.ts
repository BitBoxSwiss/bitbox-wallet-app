/**
 * Copyright 2024 Shift Crypto AG
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

import { renderHook } from '@testing-library/react';
import { useLocalizedFormattedCurrencies, useLocalizedPunctuation } from './localized';
import { describe, expect, it } from 'vitest';


describe('useLocalizedPunctuation', () => {
  describe('de-AT', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('de-AT'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });


  describe('de-CH', () => {
    it('should use apostrophe for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('de-CH'));
      expect(result.current).toEqual({ group: '’', decimal: '.' });
    });
  });

  describe('de-DE', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('de-DE'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });

  describe('en-GB', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('en-GB'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('en-CA', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('en-CA'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('en-UK', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('en-UK'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('en-US', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('en-US'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('es-ES', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('es-ES'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });

    });

  });

  describe('es-419', () => {
    it('should use comma for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('es-419'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('fr-CA', () => {
    it('should use space for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('fr-CA'));
      expect(result.current).toEqual({ group: '\xa0', decimal: ',' });
    });
  });

  describe('id-ID', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('id-ID'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });



  describe('it-IT', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('it-IT'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });

  describe('ja-JP', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('ja-JP'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('ko-KR', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('ko-KR'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });

  describe('nl-NL', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('nl-NL'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });

  describe('pt-BR', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('pt-BR'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });

  describe('ru-RU', () => {
    it('should use space for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('ru-RU'));
      expect(result.current).toEqual({ group: '\xa0', decimal: ',' });
    });
  });

  describe('tr-TR', () => {
    it('should use dot for thousand and comma for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('tr-TR'));
      expect(result.current).toEqual({ group: '.', decimal: ',' });
    });
  });

  describe('zh-CN', () => {
    it('should use comma for thousand and dot for decimal', () => {
      const { result } = renderHook(() => useLocalizedPunctuation('zh-CN'));
      expect(result.current).toEqual({ group: ',', decimal: '.' });
    });
  });


});


describe('useLocalizedFormattedCurrencies', () => {
  it('should return currencies formatted in English (en)', () => {
    const { result } = renderHook(() => useLocalizedFormattedCurrencies('en'));

    const { formattedCurrencies } = result.current;

    expect(formattedCurrencies).toEqual(
      expect.arrayContaining([
        { label: 'Australian Dollar (AUD)', value: 'AUD' },
        { label: 'Brazilian Real (BRL)', value: 'BRL' },
        { label: 'Canadian Dollar (CAD)', value: 'CAD' }
      ])
    );
  });

  it('should return currencies formatted in German (de)', () => {
    const { result } = renderHook(() => useLocalizedFormattedCurrencies('de'));

    const { formattedCurrencies } = result.current;

    expect(formattedCurrencies).toEqual(
      expect.arrayContaining([
        { label: 'Australischer Dollar (AUD)', value: 'AUD' },
        { label: 'Brasilianischer Real (BRL)', value: 'BRL' },
        { label: 'Kanadischer Dollar (CAD)', value: 'CAD' }
      ])
    );
  });

  it('should not change the displayName for BTC and sat', () => {
    const { result } = renderHook(() => useLocalizedFormattedCurrencies('de'));

    const { formattedCurrencies } = result.current;

    expect(formattedCurrencies).toEqual(
      expect.arrayContaining([
        { label: 'Bitcoin (BTC)', value: 'BTC' },
        { label: 'Satoshi (sat)', value: 'sat' }
      ])
    );
  });

});