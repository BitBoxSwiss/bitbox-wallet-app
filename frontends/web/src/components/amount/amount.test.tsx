// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { Mock, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { NativeCoinUnit, ConversionUnit } from '@/api/account';
import { Amount } from './amount';

vi.mock('react', async () => ({
  ...(await vi.importActual('react')),
  useContext: vi.fn(),
  createContext: vi.fn()
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
    elements.every(element => element.tagName.toLowerCase() === 'span') &&
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
      decimal: '.'
    });
  });

  describe('hide amounts', () => {

    it('should render triple-asterisks (***) when amount is set to be hidden', () => {
      (useContext as Mock).mockReturnValue({ hideAmounts: true });
      const { container } = render(
        <Amount amount="1'340.25" unit={'EUR'} />
      );
      expect(container).toHaveTextContent('***');
    });

  });

  describe('sat amounts', () => {
    let coins: NativeCoinUnit[] = ['sat', 'tsat'];
    coins.forEach((coin) => {
      it('12345678901234 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345678901234" unit={coin} />);
        const blocks = getByTestId('amountBlocks');

        const values = [
          '12',
          '345',
          '678',
          '901',
          '234'
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

      it('1234567 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="1234567" unit={coin} />);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '1',
          '234',
          '567',
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

      it('12345 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345" unit={coin} />);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '12',
          '345',
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

      it('21 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="21" unit={coin} />);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '21',
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

    });
  });

  describe('BTC/LTC coins amounts', () => {
    let coins: NativeCoinUnit[] = ['BTC', 'TBTC', 'LTC', 'TLTC'];
    coins.forEach(coin => {

      it('10.00000000 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="10.00000000" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '10.00',
          '000',
          '000'
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

      it('12345.12300000 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345.12300000" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '12345.12',
          '300',
          '000'
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

      it('42 ' + coin + ' stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin}/>);
        expect(container).toHaveTextContent('42');
      });

      it('0.12345678 ' + coin + ' gets spaced', () => {
        const { getByTestId } = render(<Amount amount="0.12345678" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        const values = [
          '0.12',
          '345',
          '678'
        ];
        const allSpacedElements = [...blocks.children];
        expect(validateSpacing(values, allSpacedElements)).toBeTruthy();
      });

    });
  });

  describe('non BTC coins amounts', () => {
    let coins: NativeCoinUnit[] = ['ETH', 'SEPETH'];
    coins.forEach(coin => {
      it('10.00000000 ' + coin + ' stays 10.00000000', () => {
        const { container } = render(<Amount amount="10.00000000" unit={coin}/>);
        expect(container).toHaveTextContent('10.00000000');
      });
      it('10.12300000 ' + coin + ' stays 10.12300000', () => {
        const { container } = render(<Amount amount="10.12300000" unit={coin}/>);
        expect(container).toHaveTextContent('10.12300000');
      });
      it('42 ' + coin + ' stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin}/>);
        expect(container).toHaveTextContent('42');
      });
    });
  });

  describe('fiat amounts', () => {
    let fiatCoins: ConversionUnit[] = ['USD', 'EUR', 'CHF'];
    fiatCoins.forEach(coin => {
      it('1\'340.25 ' + coin + ' stays 1\'340.25', () => {
        const { container } = render(<Amount amount="1'340.25" unit={coin}/>);
        expect(container).toHaveTextContent('1’340.25');
      });
      it('218.00 ' + coin + ' stays 218.00', () => {
        const { container } = render(<Amount amount="218.00" unit={coin}/>);
        expect(container).toHaveTextContent('218.00');
      });

    });
  });

  describe('remove trailing zeros from amounts', () => {

    it('0.00 CHF becomes 0', () => {
      const { container } = render(<Amount amount="0.00" unit="CHF" removeTrailingZeros/>);
      expect(container.textContent).toBe('0');
    });

    it('0.10 CHF becomes 0.1', () => {
      const { container } = render(<Amount amount="0.10" unit="CHF" removeTrailingZeros/>);
      expect(container.textContent).toBe('0.1');
    });

    it('1\'000 CHF stays 1’000', () => {
      const { container } = render(<Amount amount="1'000" unit="CHF" removeTrailingZeros/>);
      expect(container.textContent).toBe('1’000');
    });

    it('1\'000.00 CHF becomes 1’000', () => {
      const { container } = render(<Amount amount="1'000.00" unit="CHF" removeTrailingZeros/>);
      expect(container.textContent).toBe('1’000');
    });

    it('10 BTC stays 10', () => {
      const { container } = render(<Amount amount="10" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('10');
    });

    it('10\'000\'000 BTC stays 10’000’000', () => {
      const { container } = render(<Amount amount="10'000'000" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('10’000’000');
    });

    it('10\'000\'000.00000000 BTC becomes 10’000’000', () => {
      const { container } = render(<Amount amount="10'000'000.00000000" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('10’000’000');
    });

    it('10\'000.00 BTC becomes 10’000', () => {
      const { container } = render(<Amount amount="10'000.00" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('10’000');
    });

    it('10.010000000 BTC trims to 10.01', () => {
      const { container } = render(<Amount amount="10.010000000" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('10.01');
    });

    it('1.0 BTC becomes 1', () => {
      const { container } = render(<Amount amount="1.0" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('1');
    });

    it('1.00000001 BTC stays 1.00000001 (no false strip)', () => {
      const { container } = render(<Amount amount="1.00000001" unit="BTC" removeTrailingZeros/>);
      expect(container.textContent).toBe('1.00000001');
    });

    it('10\'000 ETH stays 10’000', () => {
      const { container } = render(<Amount amount="10'000" unit="ETH" removeTrailingZeros/>);
      expect(container.textContent).toBe('10’000');
    });

    it('10.10000000 ETH trims to 10.1', () => {
      const { container } = render(<Amount amount="10.10000000" unit="ETH" removeTrailingZeros/>);
      expect(container.textContent).toBe('10.1');
    });

    it('10100000000 sat stays 10100000000', () => {
      const { container } = render(<Amount amount="10100000000" unit="sat" removeTrailingZeros/>);
      expect(container.textContent).toBe('10100000000');
    });

  });

  afterEach(() => {
    vi.clearAllMocks();
  });

});