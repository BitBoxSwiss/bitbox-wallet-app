// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { useContext } from 'react';
import { Mock, afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TBalance } from '@/api/account';
import { Balance } from './balance';

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(true)
}));

vi.mock('react', () => ({
  useMemo: vi.fn().mockImplementation((fn) => fn()),
  useContext: vi.fn(),
  createContext: vi.fn()
}));

describe('components/balance/balance', () => {
  it('renders balance properly', () => {
    (useContext as Mock).mockReturnValue({
      btcUnit: 'default',
      defaultCurrency: 'USD',
      decimal: '.',
      group: ','
    });
    const MOCK_BALANCE: TBalance = {
      hasAvailable: true,
      hasIncoming: true,
      available: {
        amount: '0.005',
        unit: 'BTC',
        estimated: false,
        conversions: {
          BTC: '0.005',
          AUD: '512',
          BRL: '512',
          CAD: '512',
          CHF: '512',
          CNY: '512',
          CZK: '512',
          EUR: '512',
          GBP: '512',
          HKD: '512',
          ILS: '512',
          JPY: '512',
          KRW: '512',
          NOK: '512',
          PLN: '512',
          RUB: '512',
          sat: '512',
          SEK: '512',
          SGD: '512',
          USD: '512',
        }
      },
      incoming: {
        amount: '0.003',
        unit: 'BTC',
        estimated: false,
        conversions: {
          BTC: '0.003',
          AUD: '512',
          BRL: '512',
          CAD: '512',
          CHF: '512',
          CNY: '512',
          CZK: '512',
          EUR: '512',
          GBP: '512',
          HKD: '512',
          ILS: '512',
          JPY: '512',
          KRW: '512',
          NOK: '512',
          PLN: '512',
          RUB: '512',
          sat: '512',
          SEK: '512',
          SGD: '512',
          USD: '512',
        }
      }
    };
    const { getByTestId } = render(<Balance balance={MOCK_BALANCE} />);
    expect(getByTestId('availableBalance').textContent).toBe('0.005 BTC 512 USD');
    expect(getByTestId('incomingBalance').textContent).toContain('+0.003 BTC');
    expect(getByTestId('incomingBalance').textContent).toContain('512 USD');
  });
});

describe('components/balance/balance', () => {
  it('renders balance with decimal properly', () => {
    (useContext as Mock).mockReturnValue({
      btcUnit: 'default',
      defaultCurrency: 'USD',
      nativeLocale: 'en-US',
      decimal: '.',
      group: ','
    });

    const MOCK_BALANCE: TBalance = {
      hasAvailable: true,
      hasIncoming: true,
      available: {
        amount: '0.005',
        unit: 'BTC',
        estimated: false,
        conversions: {
          BTC: '0.005',
          AUD: '512',
          BRL: '512',
          CAD: '512',
          CHF: '512',
          CNY: '512',
          CZK: '512',
          EUR: '512',
          GBP: '512',
          HKD: '512',
          ILS: '512',
          JPY: '512',
          KRW: '512',
          NOK: '512',
          PLN: '512',
          RUB: '512',
          sat: '512',
          SEK: '512',
          SGD: '512',
          USD: '512',
        },
      },
      incoming: {
        amount: '0.003',
        unit: 'BTC',
        estimated: false,
        conversions: {
          BTC: '0.003',
          AUD: '512',
          BRL: '512',
          CAD: '512',
          CHF: '512',
          CNY: '512',
          CZK: '512',
          EUR: '512',
          GBP: '512',
          HKD: '512',
          ILS: '512',
          JPY: '512',
          KRW: '512',
          NOK: '512',
          PLN: '512',
          RUB: '512',
          sat: '512',
          SEK: '512',
          SGD: '512',
          USD: '1\'511.99',
        }
      }
    };
    const { getByTestId } = render(<Balance balance={MOCK_BALANCE} />);
    expect(getByTestId('availableBalance').textContent).toBe('0.005 BTC 512 USD');
    expect(getByTestId('incomingBalance').textContent).toContain('+0.003 BTC');
    expect(getByTestId('incomingBalance').textContent).toContain('1,511.99 USD');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
});
