/**
 * Copyright 2023 Shift Crypto AG
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
import { LanguageSwitch } from './language';
import { render, fireEvent } from '@testing-library/react';

import { useTranslation } from 'react-i18next';
import { TLanguagesList } from './types';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}));

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
        (useTranslation as Mock).mockReturnValue({
          t: vi.fn(),
          i18n: {
            language: lang.code
          },
        });

        const { getByTestId } = renderSwitchAndOpenDialog();
        const selectedLang = getByTestId(`language-selection-${lang.code}`);
        expect(selectedLang.getAttribute("class")).toContain('selected')
      });
    });

    it('matches main language tag', () => {
      (useTranslation as Mock).mockReturnValue({
        t: vi.fn(),
        i18n: {
          language: 'de'
        },
      });
      const { getByTestId } = renderSwitchAndOpenDialog();
      const selectedLang = getByTestId('language-selection-de');
      expect(selectedLang.getAttribute("class")).toContain('selected');
    });

    it('returns default if none matched', () => {
      (useTranslation as Mock).mockReturnValue({
        t: vi.fn(),
        i18n: {
          language: 'it'
        },
      });
      const { getByTestId } = renderSwitchAndOpenDialog();
      const defaultLang = getByTestId('language-selection-en-US');
      expect(defaultLang.getAttribute("class")).toContain('selected');
    });
  });
});
