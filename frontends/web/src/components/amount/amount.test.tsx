/**
 * Copyright 2023-2024 Shift Crypto AG
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
import {
  Mock,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render } from '@testing-library/react';
import { Amount } from './amount';
import { CoinUnit, ConversionUnit } from '@/api/account';

vi.mock('react', async () => ({
  ...(await vi.importActual('react')),
  useContext: vi.fn(),
  createContext: vi.fn(),
}));

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'de-CH' },
}));

const validateSpacing = (values: string[], elements: Element[]) => {
  // each element in `values` is an expected
  // "spaced" element. E.g:
  // ["12"] means <span class="__space__random">12</span>.

  // We can't merely compare like so:
  // expect(elements.innerHTML)toBe(<span class="space">12</span>, etc..)
  // because the className gets "transformed".

  //So we compare them like this:
  return (
    // makes sure each value corresponds to an element
    values.length === elements.length &&
    // makes sure every element is a span
    elements.every((element) => element.tagName.toLowerCase() === 'span') &&
    // and it has the correct value
    elements.every((element, index) => element.innerHTML === values[index])
  );
};

describe('Amount formatting', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  beforeEach(() => {
    (useContext as Mock).mockReturnValue({
      hideAmounts: false,
      nativeLocale: 'de-CH',
      group: '’',
      decimal: '.',
    });
  });

  describe('hide amounts', () => {
    it('should render triple-asterisks (***) when amount is set to be hidden', () => {
      (useContext as Mock).mockReturnValue({ hideAmounts: true });
      const { container } = render(<Amount amount="1'340.25" unit={'EUR'} />);
      expect(container).toHaveTextContent('***');
    });
  });

  describe('sat amounts', () => {
    let coins: CoinUnit[] = ['sat', 'tsat'];
    coins.forEach((coin) => {
      it(
        '12345678901234 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount
              amount="12345678901234"
              unit={coin}
              removeBtcTrailingZeroes
            />,
          );
          const blocks = getByTestId('amountBlocks');

          const values = ['12', '345', '678', '901', '234'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '1234567 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="1234567" unit={coin} removeBtcTrailingZeroes />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['1', '234', '567'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '12345 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="12345" unit={coin} removeBtcTrailingZeroes />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['12', '345'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '21 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="21" unit={coin} removeBtcTrailingZeroes />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['21'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '12345678901234 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="12345678901234" unit={coin} />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['12', '345', '678', '901', '234'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '1234567 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="1234567" unit={coin} />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['1', '234', '567'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '12345 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(<Amount amount="12345" unit={coin} />);
          const blocks = getByTestId('amountBlocks');
          const values = ['12', '345'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );

      it(
        '21 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(<Amount amount="21" unit={coin} />);
          const blocks = getByTestId('amountBlocks');
          const values = ['21'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );
    });
  });

  describe('BTC/LTC coins amounts', () => {
    let coins: CoinUnit[] = ['BTC', 'TBTC', 'LTC', 'TLTC'];
    coins.forEach((coin) => {
      it(
        '10.00000000 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled becomes 10',
        () => {
          const { container } = render(
            <Amount amount="10.00000000" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('10');
        },
      );
      it(
        '12345.12300000 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled becomes 12345.123',
        () => {
          const { container } = render(
            <Amount
              amount="12345.12300000"
              unit={coin}
              removeBtcTrailingZeroes
            />,
          );
          expect(container).toHaveTextContent('12345.123');
        },
      );
      it(
        '42 ' + coin + ' with removeBtcTrailingZeroes enabled stays 42',
        () => {
          const { container } = render(
            <Amount amount="42" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('42');
        },
      );
      it(
        '0.12345678 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled stays 0.12345678',
        () => {
          const { container } = render(
            <Amount amount="0.12345678" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('0.12345678');
        },
      );
      it(
        '10.00000000 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="10.00000000" unit={coin} />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['10.00', '000', '000'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );
      it(
        '12345.12300000 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="12345.12300000" unit={coin} />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['12345.12', '300', '000'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );
      it(
        '42 ' + coin + ' with removeBtcTrailingZeroes disabled stays 42',
        () => {
          const { container } = render(<Amount amount="42" unit={coin} />);
          expect(container).toHaveTextContent('42');
        },
      );
      it(
        '0.12345678 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled gets spaced',
        () => {
          const { getByTestId } = render(
            <Amount amount="0.12345678" unit={coin} />,
          );
          const blocks = getByTestId('amountBlocks');
          const values = ['0.12', '345', '678'];
          const allSpacedElements = [...blocks.children];
          expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
        },
      );
    });
  });

  describe('non BTC coins amounts', () => {
    let coins: CoinUnit[] = ['ETH', 'SEPETH'];
    coins.forEach((coin) => {
      it(
        '10.00000000 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled stays 10.00000000',
        () => {
          const { container } = render(
            <Amount amount="10.00000000" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('10.00000000');
        },
      );
      it(
        '10.12300000 ' +
          coin +
          ' with removeBtcTrailingZeroes enabled stays 10.12300000',
        () => {
          const { container } = render(
            <Amount amount="10.12300000" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('10.12300000');
        },
      );
      it(
        '42 ' + coin + ' with removeBtcTrailingZeroes enabled stays 42',
        () => {
          const { container } = render(
            <Amount amount="42" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('42');
        },
      );
      it(
        '10.00000000 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled stays 10.00000000',
        () => {
          const { container } = render(
            <Amount amount="10.00000000" unit={coin} />,
          );
          expect(container).toHaveTextContent('10.00000000');
        },
      );
      it(
        '10.12300000 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled stays 10.12300000',
        () => {
          const { container } = render(
            <Amount amount="10.12300000" unit={coin} />,
          );
          expect(container).toHaveTextContent('10.12300000');
        },
      );
      it(
        '42 ' + coin + ' with removeBtcTrailingZeroes disabled stays 42',
        () => {
          const { container } = render(<Amount amount="42" unit={coin} />);
          expect(container).toHaveTextContent('42');
        },
      );
    });
  });

  describe('fiat amounts', () => {
    let fiatCoins: ConversionUnit[] = ['USD', 'EUR', 'CHF'];
    fiatCoins.forEach((coin) => {
      it(
        "1'340.25 " +
          coin +
          " with removeBtcTrailingZeroes enabled stays 1'340.25",
        () => {
          const { container } = render(
            <Amount amount="1'340.25" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('1’340.25');
        },
      );
      it(
        '218.00 ' + coin + ' with removeBtcTrailingZeroes enabled stays 218.00',
        () => {
          const { container } = render(
            <Amount amount="218.00" unit={coin} removeBtcTrailingZeroes />,
          );
          expect(container).toHaveTextContent('218.00');
        },
      );
      it(
        "1'340.25 " +
          coin +
          " with removeBtcTrailingZeroes disabled stays 1'340.25",
        () => {
          const { container } = render(
            <Amount amount="1'340.25" unit={coin} />,
          );
          expect(container).toHaveTextContent('1’340.25');
        },
      );
      it(
        '218.00 ' +
          coin +
          ' with removeBtcTrailingZeroes disabled stays 218.00',
        () => {
          const { container } = render(<Amount amount="218.00" unit={coin} />);
          expect(container).toHaveTextContent('218.00');
        },
      );
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
