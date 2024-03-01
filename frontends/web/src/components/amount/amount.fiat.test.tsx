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

import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Amount } from './amount';
import { ConversionUnit } from '../../api/account';
import { i18n } from '../../i18n/i18n';

vi.mock('react', async () => ({
  // ...(await vi.importActual('react')),
  useContext: vi.fn(),
  createContext: vi.fn()
}));

vi.mock('../../i18n/i18n', () => ({
  i18n: { language: 'de-CH' },
}));

describe('Fiat amount formatting', () => {
  beforeEach(() => {
    (useContext as Mock).mockReturnValue({ hideAmounts: false });
  });

  describe('de-AT', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'de-AT';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('de-CH', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'de-CH';
    });
    it('should use apostrophe for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="USD" />);
      expect(container).toHaveTextContent('1’234’567.89');
    });
  });

  describe('en-CA', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'en-CA';
    });
    it('should use comma for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('en-GB', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'en-GB';
    });
    it('should use comma for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('en-IN', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'en-IN';
    });
    it('should use comma somehow and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('12,34,567.89');
    });
  });

  describe('en-US', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'en-US';
    });
    const fiatCoins: ConversionUnit[] = ['USD', 'EUR', 'CHF'];
    fiatCoins.forEach(coin => {
      it('should use comma for thousand and dot for decimal', () => {
        const { container } = render(<Amount amount="1'234'567.89" unit={coin} />);
        expect(container).toHaveTextContent('1,234,567.89');
      });
    });
  });

  describe('es-ES', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'es-ES';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('fr-FR', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'fr-FR';
    });
    it('should use space for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('fr-CA', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'fr-CA';
    });
    it('should use space for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('id-ID', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'id-ID';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('id-IT', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'id-IT';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('ja-JP', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'ja-JP';
    });
    it('should use comma for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('ko-KR', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'ko-KR';
    });
    it('should use comma for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('nl-NL', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'nl-NL';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('pt-BR', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'pt-BR';
    });
    it('should use dot for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('ru-RU', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'ru-RU';
    });
    it('should use space for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('tr-TR', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'tr-TR';
    });
    it('should use space for thousand and comma for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('zh-CN', () => {
    beforeEach(() => {
      vi.mocked(i18n).language = 'zh-CN';
    });
    it('should use comma for thousand and dot for decimal', () => {
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
