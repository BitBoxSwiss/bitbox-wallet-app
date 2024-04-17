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
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Amount } from './amount';
import { ConversionUnit } from '../../api/account';

vi.mock('react', async () => ({
  ...(await vi.importActual('react')),
  useMemo: vi.fn().mockImplementation((fn) => fn()), // not really needed here, but in balance.test.tsx
  useContext: vi.fn(),
  createContext: vi.fn()
}));


describe.only('Fiat amount formatting', () => {
  beforeEach(() => {
    (useContext as Mock).mockReturnValue({ hideAmounts: false });
  });

  describe('de-AT', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'de-AT' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('de-CH', () => {
    it('should use apostrophe for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'de-CH' });
      const { container } = render(<Amount amount="1'234'567.89" unit="USD" />);
      expect(container).toHaveTextContent('1’234’567.89');
    });
    it('should use apostrophe for thousand and dot for decimal and remove trailing zeros', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'de-CH' });
      const { container } = render(<Amount amount="1'234.56789000" unit="BTC" removeBtcTrailingZeroes />);
      expect(container).toHaveTextContent('1’234.56789');
    });
  });

  describe('de-DE', () => {
    it('should use apostrophe for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'de-DE' });
      const { container } = render(<Amount amount="1'000" unit="USD" />);
      expect(container).toHaveTextContent('1.000');
    });
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'de-DE' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('en-GB', () => {
    it('should use comma for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'en-GB' });
      const { container } = render(<Amount amount="1'234'567.89" unit="GBP" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('en-CA', () => {
    it('should use comma for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'en-CA' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  // describe('en-IN', () => {
  //   beforeEach(() => {
  //     vi.mocked(i18n).language = 'en-IN';
  //   });
  //   it('should use Indian numbering system using comma and dot for decimal', () => {
  //     const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
  //     expect(container).toHaveTextContent('12,34,567.89');
  //   });
  // });

  describe('en-UK', () => {
    it('should use comma for thousand and dot for decimal and remove trailing zeros', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'en-UK' });
      const { container } = render(<Amount amount="1'234.56789000" unit="BTC" removeBtcTrailingZeroes />);
      expect(container).toHaveTextContent('1,234.56789');
    });
  });

  describe('en-US', () => {
    const fiatCoins: ConversionUnit[] = ['USD', 'EUR', 'CHF'];
    fiatCoins.forEach(coin => {
      it('should use comma for thousand and dot for decimal', () => {
        (useContext as Mock).mockReturnValue({ nativeLocale: 'en-US' });
        const { container } = render(<Amount amount="1'234'567.89" unit={coin} />);
        expect(container).toHaveTextContent('1,234,567.89');
      });
    });
  });

  describe('es-ES', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'es-ES' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'es-ES' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('es-419', () => {
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'es-419' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('fr-CA', () => {
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'fr-CA' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('fr-FR', () => {
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'fr-FR' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('id-ID', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'id-ID' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('it-IT', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'it-IT' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('ja-JP', () => {
    it('should use comma for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'ja-JP' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('ko-KR', () => {
    it('should use comma for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'ko-KR' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

  describe('nl-NL', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'nl-NL' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('pt-BR', () => {
    it('should use dot for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'pt-BR' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('ru-RU', () => {
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'ru-RU' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1 234 567,89');
    });
  });

  describe('tr-TR', () => {
    it('should use space for thousand and comma for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'tr-TR' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1.234.567,89');
    });
  });

  describe('zh-CN', () => {
    it('should use comma for thousand and dot for decimal', () => {
      (useContext as Mock).mockReturnValue({ nativeLocale: 'zh-CN' });
      const { container } = render(<Amount amount="1'234'567.89" unit="EUR" />);
      expect(container).toHaveTextContent('1,234,567.89');
    });
  });

});
