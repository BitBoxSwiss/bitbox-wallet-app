// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TChartTransaction } from '@/api/account';
import { summedFiatAmount } from './chart';

const makeTransaction = (
  conversion: string,
  overrides: Partial<TChartTransaction> = {},
): TChartTransaction => ({
  time: 1_700_000_000,
  internalID: 'tx-1',
  accountCode: 'acc-1',
  explorerURL: 'https://example.com/tx/',
  type: 'receive',
  amountAtTime: {
    amount: '0.10000000',
    unit: 'BTC',
    estimated: false,
    conversions: {
      USD: conversion,
    },
  },
  deductedAmountAtTime: {
    amount: '0.10000000',
    unit: 'BTC',
    estimated: false,
    conversions: {
      USD: conversion,
    },
  },
  ...overrides,
});

const makeSatTransaction = (conversion: string): TChartTransaction => {
  const transaction = makeTransaction('0');
  return {
    ...transaction,
    amountAtTime: {
      ...transaction.amountAtTime,
      conversions: {
        sat: conversion,
      },
    },
    deductedAmountAtTime: {
      ...transaction.deductedAmountAtTime,
      conversions: {
        sat: conversion,
      },
    },
  };
};

describe('summedFiatAmount', () => {
  it('formats summed values with Swiss grouping', () => {
    expect(summedFiatAmount([
      makeTransaction('1,000.23'),
      makeTransaction('234.33'),
    ], 'USD')).toBe('1\'234.56');
  });

  it('sums deducted amounts for send transactions', () => {
    expect(summedFiatAmount([
      makeTransaction('999.99', {
        type: 'send',
        deductedAmountAtTime: {
          amount: '0.10000000',
          unit: 'BTC',
          estimated: false,
          conversions: {
            USD: '1,000.00',
          },
        },
      }),
      makeTransaction('234.56', {
        type: 'send',
        deductedAmountAtTime: {
          amount: '0.10000000',
          unit: 'BTC',
          estimated: false,
          conversions: {
            USD: '234.56',
          },
        },
      }),
    ], 'USD')).toBe('1\'234.56');
  });

  it('leaves sat values ungrouped for Amount sat formatting', () => {
    expect(summedFiatAmount([
      makeSatTransaction('1,000'),
      makeSatTransaction('234'),
    ], 'sat')).toBe('1234');
  });
});
