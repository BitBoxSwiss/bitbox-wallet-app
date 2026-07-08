// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TAccountBase } from '@/api/account';
import { GroupedAccountSelector } from './groupedaccountselector';

const account: TAccountBase = {
  active: false,
  code: 'btc-0',
  coinCode: 'btc',
  coinUnit: 'BTC',
  isToken: false,
  keystore: {
    connected: false,
    lastConnected: '',
    name: 'BitBox',
    rootFingerprint: 'root-fingerprint',
    watchonly: false,
  },
  name: 'Bitcoin account',
};

describe('components/groupedaccountselector', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('disables proceed when the selected account code is not available', async () => {
    render(
      <GroupedAccountSelector
        accounts={[account]}
        selected="eth-0"
        onChange={vi.fn()}
        onProceed={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'buy.info.next' })).toBeDisabled();
  });

  it('enables proceed when the selected account code is available', async () => {
    render(
      <GroupedAccountSelector
        accounts={[account]}
        selected={account.code}
        onChange={vi.fn()}
        onProceed={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'buy.info.next' })).not.toBeDisabled();
  });
});
