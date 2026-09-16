// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('disables the account selector', async () => {
    render(
      <GroupedAccountSelector
        accounts={[account]}
        disabled
        selected={account.code}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole('combobox')).toBeDisabled();
  });

  it('disables the mobile account selector trigger', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: '(max-width: 768px)',
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    });

    render(
      <GroupedAccountSelector
        accounts={[account]}
        disabled
        selected={account.code}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button')).toBeDisabled();
  });

  // Changing the source list must not auto-select an option retained from the previous list.
  it('auto-selects only the current single account after switching accounts', async () => {
    const onSingleAccount = vi.fn();
    const { rerender } = render(
      <GroupedAccountSelector accounts={[account]} onChange={vi.fn()} onSingleAccount={onSingleAccount} />
    );
    await waitFor(() => expect(onSingleAccount).toHaveBeenCalledWith(account.code));
    const onReplacementAccount = vi.fn();
    const replacement = { ...account, code: 'btc-1' };
    rerender(
      <GroupedAccountSelector accounts={[replacement]} onChange={vi.fn()} onSingleAccount={onReplacementAccount} />
    );
    await waitFor(() => expect(onReplacementAccount).toHaveBeenCalledWith(replacement.code));
    expect(onReplacementAccount).not.toHaveBeenCalledWith(account.code);
  });
});
