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

import 'jest';
import { LanguageSwitch } from './language';
import { render, fireEvent } from '@testing-library/react';

import { useTranslation } from 'react-i18next';
import { TLanguagesList } from './types';

jest.mock('react-i18next');
const useTranslationSpy = useTranslation;

describe('components/language/language', () => {


  const supportedLangs = [
    { code: 'en-US', display: 'English' },
    { code: 'pt', display: 'Portugues' },
    { code: 'ms', display: 'Bahasa Melayu' },
    { code: 'de', display: 'Deutsch' },
  ] as TLanguagesList;

  /**
   * renderSwitchAndOpenDialog is a util function used to render
   * the language switch and open the language dialog. This returns
   * `RenderResult` from the render function of `@testing-library/react`.
   */
  function renderSwitchAndOpenDialog() {
    const rendered = render(<LanguageSwitch languages={supportedLangs} />);
    const btn = rendered.getByTitle('Select Language');
    fireEvent.click(btn);
    return rendered;
  }

  describe('selectedIndex', () => {
    supportedLangs.forEach((lang) => {
      it(`returns exact match (${lang.code})`, () => {
        (useTranslationSpy as jest.Mock).mockReturnValue({
          t: jest.fn(),
          i18n: {
            language: lang.code
          },
        });

        const { getByTestId } = renderSwitchAndOpenDialog();
        const selectedLang = getByTestId(`language-selection-${lang.code}`);
        expect(selectedLang.classList.contains('selected')).toBe(true);
      });
    });

    it('matches main language tag', () => {
      (useTranslationSpy as jest.Mock).mockReturnValue({
        t: jest.fn(),
        i18n: {
          language: 'de'
        },
      });
      const { getByTestId } = renderSwitchAndOpenDialog();
      const selectedLang = getByTestId('language-selection-de');
      expect(selectedLang.classList.contains('selected')).toBe(true);
    });

    it('returns default if none matched', () => {
      (useTranslationSpy as jest.Mock).mockReturnValue({
        t: jest.fn(),
        i18n: {
          language: 'it'
        },
      });
      const { getByTestId } = renderSwitchAndOpenDialog();
      const defaultLang = getByTestId('language-selection-en-US');
      expect(defaultLang.classList.contains('selected')).toBe(true);
    });
  });
});
