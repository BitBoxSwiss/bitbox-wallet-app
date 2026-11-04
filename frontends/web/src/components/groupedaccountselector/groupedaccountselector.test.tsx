// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TAccountBase } from '@/api/account';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
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

  // Both selectors disable syncing accounts and show a spinner only for that reason, not for other restrictions.
  it.each([false, true])('distinguishes syncing from disabled accounts on mobile=%s', async isMobile => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockReturnValue({
      ...window.matchMedia('(max-width: 768px)'),
      matches: isMobile,
    });
    render(
      <BackButtonProvider>
        <GroupedAccountSelector
          accounts={[account, { ...account, code: 'disabled', name: 'Disabled account' }]}
          isAccountDisabled={candidate => candidate.code === 'disabled'}
          isAccountSyncing={candidate => candidate.code === account.code}
          onChange={vi.fn()}
        />
      </BackButtonProvider>,
    );

    await user.click(await screen.findByRole(isMobile ? 'button' : 'combobox'));
    const syncing = await screen.findByRole(isMobile ? 'button' : 'option', { name: /Bitcoin account/ });
    const disabled = screen.getByRole(isMobile ? 'button' : 'option', { name: /Disabled account/ });
    expect(within(syncing).getByRole('status')).toBeInTheDocument();
    expect(within(disabled).queryByRole('status')).not.toBeInTheDocument();
    if (isMobile) {
      expect(syncing).toBeDisabled();
      expect(disabled).toBeDisabled();
    } else {
      expect(syncing).toHaveAttribute('aria-disabled', 'true');
      expect(disabled).toHaveAttribute('aria-disabled', 'true');
    }
  });
});
